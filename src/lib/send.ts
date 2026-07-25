import { prisma } from "./prisma";
import { getGmail } from "./google";
import { withRetry } from "./concurrency";
import { textToHtml } from "./mime";
import { recomputeTicket } from "./sync";
import { ATTRIBUTION_METHODS } from "./attribution";
import { isDemoAccount } from "./demo";

/** 非 ASCII を含むヘッダー値を RFC 2047 でエンコードする（日本語の件名・氏名用） */
function encodeHeaderValue(value: string): string {
  if (/^[\x20-\x7e]*$/.test(value)) return value;
  return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

function formatAddress(email: string, name?: string | null): string {
  if (!name) return email;
  return `${encodeHeaderValue(name)} <${email}>`;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 本文と各種ヘッダーから RFC 5322 形式のメールを組み立てる */
function buildRawMessage(params: {
  fromEmail: string;
  fromName: string | null;
  to: string[];
  cc: string[];
  subject: string;
  textBody: string;
  htmlBody: string;
  inReplyTo: string | null;
  references: string | null;
}): string {
  const boundary = `----=_Part_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2)}`;

  const headers: string[] = [
    `From: ${formatAddress(params.fromEmail, params.fromName)}`,
    `To: ${params.to.join(", ")}`,
  ];
  if (params.cc.length > 0) headers.push(`Cc: ${params.cc.join(", ")}`);
  headers.push(`Subject: ${encodeHeaderValue(params.subject)}`);
  if (params.inReplyTo) headers.push(`In-Reply-To: ${params.inReplyTo}`);
  if (params.references) headers.push(`References: ${params.references}`);
  headers.push("MIME-Version: 1.0");
  headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);

  const body = [
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(params.textBody, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    Buffer.from(params.htmlBody, "utf8").toString("base64").replace(/(.{76})/g, "$1\r\n"),
    "",
    `--${boundary}--`,
    "",
  ];

  return [...headers, ...body].join("\r\n");
}

export type SendReplyParams = {
  accountId: string;
  ticketId: number;
  /** 送信者（社内担当者）。履歴に確実に残すため必須 */
  authorAgentId: string;
  bodyText: string;
  /** 署名に担当者名を入れるか（Gmail 側で見たときも誰が返信したか分かる） */
  includeSignature: boolean;
  /** 追加の Cc 宛先 */
  cc?: string[];
};

export async function sendReply(
  params: SendReplyParams
): Promise<{ messageId: string; demo: boolean }> {
  const demo = await isDemoAccount(params.accountId);

  const ticket = await prisma.ticket.findUnique({
    where: { id: params.ticketId },
    include: { contact: true },
  });
  if (!ticket) throw new Error("チケットが見つかりません。");

  const author = await prisma.agentIdentity.findUnique({
    where: { id: params.authorAgentId },
  });
  if (!author) throw new Error("送信者として指定された担当者が見つかりません。");

  const account = await prisma.account.findUnique({ where: { id: params.accountId } });
  if (!account) throw new Error("アカウントが見つかりません。");

  // スレッドの最後のメールを参照して、返信が同じスレッドにぶら下がるようにする
  const lastMessage = await prisma.message.findFirst({
    where: { ticketId: ticket.id },
    orderBy: { sentAt: "desc" },
  });

  const recipient = lastMessage?.replyTo || ticket.contact.email;

  const references = [lastMessage?.referencesRaw, lastMessage?.headerMessageId]
    .filter(Boolean)
    .join(" ")
    .trim();

  const subject = ticket.subject.match(/^\s*re\s*[:：]/i)
    ? ticket.subject
    : `Re: ${ticket.subject}`;

  const signature = params.includeSignature ? `\n\n--\n${author.name}` : "";
  const textBody = `${params.bodyText}${signature}`;

  const htmlBody = `<!DOCTYPE html><html><body>${textToHtml(
    params.bodyText
  )}${
    params.includeSignature
      ? `<div style="color:#667085;margin-top:16px">--<br>${escapeHtml(author.name)}</div>`
      : ""
  }</body></html>`;

  const raw = buildRawMessage({
    fromEmail: account.email,
    fromName: account.name,
    to: [recipient],
    cc: params.cc ?? [],
    subject,
    textBody,
    htmlBody,
    inReplyTo: lastMessage?.headerMessageId ?? null,
    references: references || null,
  });

  let sentId: string;

  if (demo) {
    // デモモードでは Gmail を一切呼ばない。
    // 「アプリから送ると送信者が確実に記録される」動きだけを再現する。
    sentId = `demo-sent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  } else {
    const gmail = await getGmail(params.accountId);
    const res = await withRetry(
      () =>
        gmail.users.messages.send({
          userId: "me",
          requestBody: {
            raw: toBase64Url(raw),
            threadId: ticket.gmailThreadId,
          },
        }),
      { label: "メール送信" }
    );

    if (!res.data.id) {
      throw new Error("送信は完了しましたが、メール ID を取得できませんでした。");
    }
    sentId = res.data.id;
  }

  // 送信直後に自分でレコードを作る。
  // ここで authorAgentId を確実に記録するので、後の同期で「送信者不明」にならない。
  const existing = await prisma.message.findUnique({
    where: { gmailMessageId: sentId },
  });

  if (!existing) {
    await prisma.message.create({
      data: {
        gmailMessageId: sentId,
        gmailThreadId: ticket.gmailThreadId,
        ticketId: ticket.id,
        direction: "OUTBOUND",
        fromEmail: account.email,
        fromName: account.name,
        senderEmail: author.email,
        toJson: JSON.stringify([{ name: null, email: recipient }]),
        ccJson: JSON.stringify((params.cc ?? []).map((e) => ({ name: null, email: e }))),
        subject,
        snippet: params.bodyText.slice(0, 200),
        bodyHtml: textToHtml(params.bodyText),
        bodyText: textBody,
        sentAt: new Date(),
        authorAgentId: author.id,
        attributionMethod: ATTRIBUTION_METHODS.APP,
        attributionLocked: true,
        sentViaApp: true,
        labelsJson: JSON.stringify(["SENT"]),
      },
    });
  }

  await prisma.activityLog.create({
    data: {
      ticketId: ticket.id,
      type: "MESSAGE_SENT",
      actorId: author.id,
      detailJson: JSON.stringify({
        subject,
        to: recipient,
        via: demo ? "demo（実送信なし）" : "app",
        gmailMessageId: sentId,
      }),
    },
  });

  // 返信したのでステータスを「対応中」に戻す
  if (ticket.status === "SOLVED" || ticket.status === "CLOSED") {
    await prisma.ticket.update({
      where: { id: ticket.id },
      data: { status: "OPEN" },
    });
  }

  await recomputeTicket(ticket.gmailThreadId);

  return { messageId: sentId, demo };
}
