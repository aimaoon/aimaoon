import type { gmail_v1 } from "googleapis";
import sanitizeHtml from "sanitize-html";
import { prisma } from "./prisma";
import { getGmail, getOwnAddresses } from "./google";
import { env } from "./env";
import { mapWithConcurrency, withRetry } from "./concurrency";
import {
  getHeader,
  parseAddressList,
  parseSingleAddress,
  decodeMimeWords,
  extractBody,
  sanitizeEmailHtml,
  textToHtml,
  splitQuotedHtml,
  splitQuotedText,
  type EmailAddress,
} from "./mime";
import {
  ATTRIBUTION_METHODS,
  attributeOutbound,
  ensureAgentForDelegate,
  loadAttributionContext,
  colorForString,
  type AttributionContext,
} from "./attribution";

const CONCURRENCY = 8;

/** 同一プロセス内で同期が二重に走らないようにするためのガード */
const inFlight = new Set<string>();

export type SyncResult = {
  imported: number;
  updatedTickets: number;
  mode: "full" | "incremental";
};

/* ────────────────────────────────────────────────────────────────
 * エントリポイント
 * ──────────────────────────────────────────────────────────────── */

export function isSyncing(accountId: string): boolean {
  return inFlight.has(accountId);
}

/** バックグラウンドで同期を開始する（すでに実行中なら何もしない） */
export function startSync(accountId: string, options: { full?: boolean } = {}): boolean {
  if (inFlight.has(accountId)) return false;
  inFlight.add(accountId);

  void (async () => {
    try {
      await prisma.syncState.update({
        where: { accountId },
        data: {
          running: true,
          startedAt: new Date(),
          lastError: null,
          progressNote: "メール一覧を取得しています…",
        },
      });

      const result = await runSync(accountId, options);

      await prisma.syncState.update({
        where: { accountId },
        data: {
          running: false,
          lastSyncedAt: new Date(),
          progressNote: `${result.imported} 件のメールを取り込みました`,
        },
      });
    } catch (e) {
      console.error("同期に失敗しました", e);
      await prisma.syncState
        .update({
          where: { accountId },
          data: {
            running: false,
            lastError: (e as Error).message ?? String(e),
            progressNote: null,
          },
        })
        .catch(() => undefined);
    } finally {
      inFlight.delete(accountId);
    }
  })();

  return true;
}

async function runSync(
  accountId: string,
  options: { full?: boolean }
): Promise<SyncResult> {
  const gmail = await getGmail(accountId);
  const ownAddresses = await getOwnAddresses(accountId);
  const state = await prisma.syncState.findUnique({ where: { accountId } });

  const wantsFull = options.full || !state?.initialDone || !state?.lastHistoryId;

  // 同期の開始時点の historyId を控えておく（差分同期の起点）
  const profile = await withRetry(
    () => gmail.users.getProfile({ userId: "me" }),
    { label: "プロフィール取得" }
  );
  const currentHistoryId = profile.data.historyId ?? null;

  let messageIds: string[];
  let mode: "full" | "incremental";

  if (wantsFull) {
    mode = "full";
    messageIds = await listAllMessageIds(gmail, accountId);
  } else {
    mode = "incremental";
    const incremental = await listIncrementalMessageIds(gmail, state!.lastHistoryId!);
    if (incremental === null) {
      // historyId が古すぎて使えない → 全件同期にフォールバック
      mode = "full";
      messageIds = await listAllMessageIds(gmail, accountId);
    } else {
      messageIds = incremental;
    }
  }

  // すでに取り込み済みのものは除外する
  const known = await prisma.message.findMany({
    where: { gmailMessageId: { in: messageIds } },
    select: { gmailMessageId: true },
  });
  const knownSet = new Set(known.map((m) => m.gmailMessageId));
  const pending = messageIds.filter((id) => !knownSet.has(id));

  await prisma.syncState.update({
    where: { accountId },
    data: {
      progressNote: `${pending.length} 件のメールを読み込んでいます…`,
      importedCount: 0,
    },
  });

  const ctx = await loadAttributionContext(ownAddresses);
  const touchedThreads = new Set<string>();
  let imported = 0;

  // Gmail API を叩く部分だけ並列化し、DB 書き込みは順番に行う（SQLite の書き込み競合を避ける）
  const BATCH = 50;
  for (let offset = 0; offset < pending.length; offset += BATCH) {
    const batch = pending.slice(offset, offset + BATCH);

    const fetched = await mapWithConcurrency(batch, CONCURRENCY, async (id) => {
      try {
        const res = await withRetry(
          () => gmail.users.messages.get({ userId: "me", id, format: "full" }),
          { label: "メール取得" }
        );
        return res.data;
      } catch (e) {
        console.warn(`メール ${id} の取得に失敗しました:`, (e as Error).message);
        return null;
      }
    });

    for (const raw of fetched) {
      if (!raw) continue;
      try {
        const result = await importMessage(raw, ownAddresses, ctx);
        if (result) {
          imported++;
          touchedThreads.add(result.threadId);
        }
      } catch (e) {
        console.warn(`メール ${raw.id} の取り込みに失敗しました:`, (e as Error).message);
      }
    }

    await prisma.syncState.update({
      where: { accountId },
      data: {
        importedCount: imported,
        progressNote: `${imported} / ${pending.length} 件を取り込み中…`,
      },
    });
  }

  // チケットの集計値を更新
  for (const threadId of touchedThreads) {
    await recomputeTicket(threadId);
  }

  await prisma.syncState.update({
    where: { accountId },
    data: {
      lastHistoryId: currentHistoryId,
      initialDone: true,
    },
  });

  return { imported, updatedTickets: touchedThreads.size, mode };
}

/* ────────────────────────────────────────────────────────────────
 * メール ID の列挙
 * ──────────────────────────────────────────────────────────────── */

async function listAllMessageIds(
  gmail: gmail_v1.Gmail,
  accountId: string
): Promise<string[]> {
  const parts = ["-in:chats", "-is:draft"];
  if (env.syncDaysBack > 0) parts.push(`newer_than:${env.syncDaysBack}d`);
  const q = parts.join(" ");

  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const res = await withRetry(
      () =>
        gmail.users.messages.list({
          userId: "me",
          q,
          maxResults: 500,
          pageToken,
        }),
      { label: "メール一覧取得" }
    );

    for (const msg of res.data.messages ?? []) {
      if (msg.id) ids.push(msg.id);
    }
    pageToken = res.data.nextPageToken ?? undefined;

    await prisma.syncState
      .update({
        where: { accountId },
        data: { progressNote: `メール一覧を取得中… (${ids.length} 件)` },
      })
      .catch(() => undefined);
  } while (pageToken && ids.length < env.syncMaxMessages);

  return ids.slice(0, env.syncMaxMessages);
}

/** 差分同期。historyId が古すぎる場合は null を返す（全件同期にフォールバックさせる） */
async function listIncrementalMessageIds(
  gmail: gmail_v1.Gmail,
  startHistoryId: string
): Promise<string[] | null> {
  const ids = new Set<string>();
  let pageToken: string | undefined;

  try {
    do {
      const res = await withRetry(
        () =>
          gmail.users.history.list({
            userId: "me",
            startHistoryId,
            historyTypes: ["messageAdded"],
            maxResults: 500,
            pageToken,
          }),
        { label: "履歴取得" }
      );

      for (const record of res.data.history ?? []) {
        for (const added of record.messagesAdded ?? []) {
          const msg = added.message;
          if (!msg?.id) continue;
          const labels = msg.labelIds ?? [];
          if (labels.includes("DRAFT") || labels.includes("CHAT")) continue;
          if (labels.includes("SPAM") || labels.includes("TRASH")) continue;
          ids.add(msg.id);
        }
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  } catch (e) {
    const status = (e as { code?: number }).code;
    if (status === 404) return null; // historyId が失効している
    throw e;
  }

  return [...ids];
}

/* ────────────────────────────────────────────────────────────────
 * 1 通の取り込み
 * ──────────────────────────────────────────────────────────────── */

async function importMessage(
  raw: gmail_v1.Schema$Message,
  ownAddresses: Set<string>,
  ctx: AttributionContext
): Promise<{ threadId: string } | null> {
  if (!raw.id || !raw.threadId) return null;

  const labels = raw.labelIds ?? [];
  if (labels.includes("DRAFT") || labels.includes("CHAT")) return null;

  const headers = raw.payload?.headers ?? undefined;
  const from = parseSingleAddress(getHeader(headers, "from"));
  if (!from) return null;

  const to = parseAddressList(getHeader(headers, "to"));
  const cc = parseAddressList(getHeader(headers, "cc"));
  const bcc = parseAddressList(getHeader(headers, "bcc"));
  const senderHeader = parseSingleAddress(getHeader(headers, "sender"));
  const replyTo = parseSingleAddress(getHeader(headers, "reply-to"));

  const subject = decodeMimeWords(getHeader(headers, "subject")) || "(件名なし)";
  const dateHeader = getHeader(headers, "date");
  const sentAt = resolveDate(dateHeader, raw.internalDate);

  // ── 向きの判定 ────────────────────────────────────────────────
  // SENT ラベルが最も確実。無い場合は From が自社アドレスかで判断する
  const isOutbound =
    labels.includes("SENT") || ownAddresses.has(from.email.toLowerCase());
  const direction = isOutbound ? "OUTBOUND" : "INBOUND";

  // ── 顧客の特定 ────────────────────────────────────────────────
  const contactAddress = pickContact(direction, from, to, cc, ownAddresses);
  if (!contactAddress) return null; // 自分から自分へのメール等は取り込まない

  // ── 本文 ──────────────────────────────────────────────────────
  const body = extractBody(raw.payload ?? undefined);

  let mainHtml: string | null = null;
  let quotedHtml: string | null = null;

  if (body.html) {
    const split = splitQuotedHtml(body.html);
    mainHtml = sanitizeEmailHtml(split.main);
    quotedHtml = split.quoted ? sanitizeEmailHtml(split.quoted) : null;
  } else if (body.text) {
    const split = splitQuotedText(body.text);
    mainHtml = textToHtml(split.main);
    quotedHtml = split.quoted ? textToHtml(split.quoted) : null;
  }

  // 署名の照合に使うプレーンテキスト（引用部分は除く）
  const bodyText =
    body.text != null
      ? splitQuotedText(body.text).main
      : mainHtml
        ? sanitizeHtml(mainHtml, { allowedTags: [], allowedAttributes: {} })
        : null;

  // ── 送信者の判別 ──────────────────────────────────────────────
  let authorAgentId: string | null = null;
  let attributionMethod: string = ATTRIBUTION_METHODS.UNKNOWN;

  if (direction === "OUTBOUND") {
    const result = attributeOutbound(
      {
        fromEmail: from.email,
        fromName: from.name,
        senderEmail: senderHeader?.email ?? null,
        bodyText,
      },
      ctx
    );

    if (result.agentId) {
      authorAgentId = result.agentId;
      attributionMethod = result.method;
    } else if (
      result.evidence &&
      result.method === ATTRIBUTION_METHODS.UNKNOWN &&
      senderHeader
    ) {
      // 委任送信で未知のアドレスを見つけた → 担当者として自動登録する
      authorAgentId = await ensureAgentForDelegate(result.evidence);
      attributionMethod = ATTRIBUTION_METHODS.DELEGATE_HEADER;
      ctx.agentsByEmail.set(result.evidence, authorAgentId);
    }
  }

  // ── チケットの取得または作成 ──────────────────────────────────
  const contact = await upsertContact(contactAddress);
  const ticket = await upsertTicket(raw.threadId, subject, contact.id, sentAt);

  await prisma.message.create({
    data: {
      gmailMessageId: raw.id,
      gmailThreadId: raw.threadId,
      ticketId: ticket.id,
      direction,
      headerMessageId: getHeader(headers, "message-id"),
      inReplyTo: getHeader(headers, "in-reply-to"),
      referencesRaw: getHeader(headers, "references"),
      fromEmail: from.email,
      fromName: from.name,
      senderEmail: senderHeader?.email ?? null,
      replyTo: replyTo?.email ?? null,
      toJson: JSON.stringify(to),
      ccJson: JSON.stringify(cc),
      bccJson: JSON.stringify(bcc),
      subject,
      snippet: raw.snippet ? decodeHtmlEntities(raw.snippet) : null,
      bodyHtml: mainHtml,
      quotedHtml,
      bodyText,
      sentAt,
      authorAgentId,
      attributionMethod,
      hasAttachments: body.attachments.length > 0,
      attachmentsJson: JSON.stringify(body.attachments),
      labelsJson: JSON.stringify(labels),
    },
  });

  await prisma.activityLog.create({
    data: {
      ticketId: ticket.id,
      type: direction === "INBOUND" ? "MESSAGE_RECEIVED" : "MESSAGE_SENT",
      actorId: authorAgentId,
      actorLabel:
        direction === "INBOUND"
          ? from.name || from.email
          : authorAgentId
            ? null
            : "Gmail から直接送信（送信者不明）",
      detailJson: JSON.stringify({
        subject,
        gmailMessageId: raw.id,
        attributionMethod,
      }),
      createdAt: sentAt,
    },
  });

  return { threadId: raw.threadId };
}

/* ────────────────────────────────────────────────────────────────
 * 補助
 * ──────────────────────────────────────────────────────────────── */

function resolveDate(dateHeader: string | null, internalDate?: string | null): Date {
  if (internalDate) {
    const ms = Number(internalDate);
    if (Number.isFinite(ms) && ms > 0) return new Date(ms);
  }
  if (dateHeader) {
    const parsed = new Date(dateHeader);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return new Date();
}

/** この会話の「相手」を決める */
function pickContact(
  direction: string,
  from: EmailAddress,
  to: EmailAddress[],
  cc: EmailAddress[],
  ownAddresses: Set<string>
): EmailAddress | null {
  if (direction === "INBOUND") {
    if (ownAddresses.has(from.email)) return null;
    return from;
  }
  // 送信メールでは、宛先のうち自社アドレスでない最初の相手
  const candidate =
    to.find((a) => !ownAddresses.has(a.email)) ??
    cc.find((a) => !ownAddresses.has(a.email));
  return candidate ?? null;
}

async function upsertContact(address: EmailAddress) {
  const email = address.email.toLowerCase();
  const existing = await prisma.contact.findUnique({ where: { email } });

  if (existing) {
    // 名前が未登録なら埋める
    if (!existing.name && address.name) {
      return prisma.contact.update({
        where: { id: existing.id },
        data: { name: address.name },
      });
    }
    return existing;
  }

  return prisma.contact.create({
    data: { email, name: address.name },
  });
}

async function upsertTicket(
  threadId: string,
  subject: string,
  contactId: string,
  sentAt: Date
) {
  const existing = await prisma.ticket.findUnique({
    where: { gmailThreadId: threadId },
  });
  if (existing) return existing;

  const ticket = await prisma.ticket.create({
    data: {
      gmailThreadId: threadId,
      subject: normalizeSubject(subject),
      contactId,
      firstMessageAt: sentAt,
      lastMessageAt: sentAt,
    },
  });

  await prisma.activityLog.create({
    data: {
      ticketId: ticket.id,
      type: "TICKET_CREATED",
      actorLabel: "自動（メール受信）",
      detailJson: JSON.stringify({ subject }),
      createdAt: sentAt,
    },
  });

  return ticket;
}

/** 件名から Re:/Fwd: の繰り返しを取り除く */
export function normalizeSubject(subject: string): string {
  return subject
    .replace(/^(\s*(re|fw|fwd|返信|転送)\s*(\[\d+\])?\s*[:：])+/gi, "")
    .trim() || subject;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** チケットの集計値（最終更新日時・未返信・複数担当など）を再計算する */
export async function recomputeTicket(threadId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { gmailThreadId: threadId },
    select: { id: true, unread: true },
  });
  if (!ticket) return;

  const messages = await prisma.message.findMany({
    where: { ticketId: ticket.id },
    select: {
      direction: true,
      sentAt: true,
      authorAgentId: true,
      attributionMethod: true,
    },
    orderBy: { sentAt: "asc" },
  });

  if (messages.length === 0) return;

  const inbound = messages.filter((m) => m.direction === "INBOUND");
  const outbound = messages.filter((m) => m.direction === "OUTBOUND");

  const lastInboundAt = inbound.at(-1)?.sentAt ?? null;
  const lastOutboundAt = outbound.at(-1)?.sentAt ?? null;

  // 会話に関わった社内メンバーの数（不明も 1 種類として数える）
  const authorKeys = new Set(
    outbound.map((m) => m.authorAgentId ?? `unknown:${m.attributionMethod}`)
  );

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      messageCount: messages.length,
      firstMessageAt: messages[0].sentAt,
      lastMessageAt: messages.at(-1)!.sentAt,
      lastInboundAt,
      lastOutboundAt,
      awaitingReply:
        lastInboundAt !== null &&
        (lastOutboundAt === null || lastInboundAt > lastOutboundAt),
      multiAgent: authorKeys.size > 1,
    },
  });
}

/** 全チケットの集計値を再計算する（ルール変更後などに使う） */
export async function recomputeAllTickets(): Promise<number> {
  const tickets = await prisma.ticket.findMany({ select: { gmailThreadId: true } });
  for (const t of tickets) {
    await recomputeTicket(t.gmailThreadId);
  }
  return tickets.length;
}

export { colorForString };
