import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/Avatar";
import { QuotedBody } from "@/components/QuotedBody";
import { ReplyComposer } from "@/components/ReplyComposer";
import { TicketControls } from "@/components/TicketControls";
import { MessageAuthorPicker } from "@/components/MessageAuthorPicker";
import { suggestSignaturePatterns } from "@/lib/attribution";
import { isDemoAccount } from "@/lib/demo";
import {
  ACTIVITY_LABELS,
  formatBytes,
  formatDateTime,
  formatRelative,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/format";
import type { Attachment, EmailAddress } from "@/lib/mime";

export const dynamic = "force-dynamic";

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const ticketId = Number((await params).id);
  if (!Number.isInteger(ticketId)) notFound();

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      contact: true,
      assignee: true,
      messages: {
        orderBy: { sentAt: "asc" },
        include: { authorAgent: true },
      },
      notes: {
        orderBy: { createdAt: "asc" },
        include: { author: true },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 60,
        include: { actor: true },
      },
    },
  });

  if (!ticket) notFound();

  // 開いたら既読にする
  if (ticket.unread) {
    await prisma.ticket.update({ where: { id: ticket.id }, data: { unread: false } });
  }

  const demo = await isDemoAccount(session.accountId);

  // 同じ顧客との他の案件があるかどうか（右カラムの導線に使う）
  const contactTicketCount = await prisma.ticket.count({
    where: { contactId: ticket.contactId },
  });

  const agents = await prisma.agentIdentity.findMany({
    where: { active: true },
    select: { id: true, name: true, color: true, isMe: true },
    orderBy: [{ isMe: "desc" }, { name: "asc" }],
  });
  const agentOptions = agents.map(({ id, name, color }) => ({ id, name, color }));
  const meId = agents.find((a) => a.isMe)?.id ?? agents[0]?.id ?? null;

  // メールと社内メモを時系列に混ぜる
  type Entry =
    | { kind: "message"; at: Date; data: (typeof ticket.messages)[number] }
    | { kind: "note"; at: Date; data: (typeof ticket.notes)[number] };

  const timeline: Entry[] = [
    ...ticket.messages.map((m) => ({ kind: "message" as const, at: m.sentAt, data: m })),
    ...ticket.notes.map((n) => ({ kind: "note" as const, at: n.createdAt, data: n })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  // この会話に関わった社内メンバーの一覧
  const responderMap = new Map<
    string,
    { name: string; color: string; count: number; unknown: boolean }
  >();
  for (const m of ticket.messages) {
    if (m.direction !== "OUTBOUND") continue;
    const key = m.authorAgentId ?? "__unknown__";
    const existing = responderMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      responderMap.set(key, {
        name: m.authorAgent?.name ?? "送信者不明",
        color: m.authorAgent?.color ?? "#8892a3",
        count: 1,
        unknown: !m.authorAgent,
      });
    }
  }
  const responders = [...responderMap.values()].sort((a, b) => b.count - a.count);
  const unknownCount = responders.find((r) => r.unknown)?.count ?? 0;

  return (
    <div className="flex h-full min-w-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* ヘッダー */}
        <header className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs tabular-nums text-[var(--text-muted)]">
                  #{ticket.id}
                </span>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                  style={{ background: STATUS_COLORS[ticket.status] }}
                >
                  {STATUS_LABELS[ticket.status]}
                </span>
                {ticket.awaitingReply && (
                  <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                    未返信
                  </span>
                )}
              </div>
              <h1 className="mt-1 truncate text-base font-semibold">{ticket.subject}</h1>
              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">
                {ticket.contact.name
                  ? `${ticket.contact.name} <${ticket.contact.email}>`
                  : ticket.contact.email}
                {" · "}
                {ticket.messageCount} 通 · 最終更新 {formatRelative(ticket.lastMessageAt)}
              </p>
            </div>
          </div>

          <div className="mt-2.5">
            <TicketControls
              ticketId={ticket.id}
              status={ticket.status}
              priority={ticket.priority}
              assigneeId={ticket.assigneeId}
              agents={agentOptions}
            />
          </div>

          {/* 誰が対応したかのサマリー — この画面で一番見たい情報 */}
          {responders.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg bg-[var(--surface-2)] px-3 py-2">
              <span className="text-[11px] font-medium text-[var(--text-muted)]">
                この会話に返信した人:
              </span>
              {responders.map((r, i) => (
                <span key={i} className="flex items-center gap-1.5 text-xs">
                  <Avatar name={r.name} color={r.color} size={20} dimmed={r.unknown} />
                  <span className={r.unknown ? "text-[var(--text-muted)]" : ""}>
                    {r.name}
                  </span>
                  <span className="tabular-nums text-[var(--text-muted)]">
                    {r.count}通
                  </span>
                </span>
              ))}
              {unknownCount > 0 && (
                <span className="text-[11px] text-amber-700 dark:text-amber-400">
                  送信者不明の返信は、そのメールの「送信者不明」バッジから設定できます
                </span>
              )}
            </div>
          )}
        </header>

        {/* タイムライン */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ul className="space-y-3">
            {timeline.map((entry) => {
              if (entry.kind === "note") {
                const note = entry.data;
                return (
                  <li
                    key={`note-${note.id}`}
                    className="rounded-xl border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar
                        name={note.author?.name ?? "?"}
                        color={note.author?.color}
                        size={22}
                        dimmed={!note.author}
                      />
                      <span className="text-xs font-medium">
                        {note.author?.name ?? "不明"}
                      </span>
                      <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-medium text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                        社内メモ
                      </span>
                      <span className="ml-auto text-[11px] text-[var(--text-muted)]">
                        {formatDateTime(note.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                      {note.body}
                    </p>
                  </li>
                );
              }

              const message = entry.data;
              const inbound = message.direction === "INBOUND";
              const to = parseJson<EmailAddress[]>(message.toJson, []);
              const cc = parseJson<EmailAddress[]>(message.ccJson, []);
              const attachments = parseJson<Attachment[]>(message.attachmentsJson, []);

              const displayName = inbound
                ? message.fromName || message.fromEmail
                : message.authorAgent?.name ?? "送信者不明";

              return (
                <li
                  key={message.id}
                  className={`rounded-xl border p-3 ${
                    inbound
                      ? "border-[var(--border)] bg-[var(--surface)]"
                      : "border-brand-200 bg-brand-50 dark:border-ink-700 dark:bg-ink-800"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Avatar
                      name={displayName}
                      color={
                        inbound ? "#667085" : message.authorAgent?.color ?? "#8892a3"
                      }
                      size={26}
                      dimmed={!inbound && !message.authorAgent}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {displayName}
                        <span className="ml-1.5 text-[11px] font-normal text-[var(--text-muted)]">
                          {inbound ? "（お客様）" : "（自社からの返信）"}
                        </span>
                      </p>
                      <p className="truncate text-[11px] text-[var(--text-muted)]">
                        {message.fromEmail}
                        {to.length > 0 && ` → ${to.map((a) => a.email).join(", ")}`}
                        {cc.length > 0 && ` / Cc: ${cc.map((a) => a.email).join(", ")}`}
                      </p>
                    </div>

                    <div className="ml-auto flex items-center gap-2">
                      {!inbound && (
                        <MessageAuthorPicker
                          messageId={message.id}
                          currentAgent={
                            message.authorAgent
                              ? {
                                  id: message.authorAgent.id,
                                  name: message.authorAgent.name,
                                  color: message.authorAgent.color,
                                }
                              : null
                          }
                          method={message.attributionMethod}
                          agents={agentOptions}
                          signatureSuggestions={suggestSignaturePatterns(message.bodyText)}
                        />
                      )}
                      <time
                        className="shrink-0 text-[11px] text-[var(--text-muted)]"
                        dateTime={message.sentAt.toISOString()}
                        title={formatDateTime(message.sentAt)}
                      >
                        {formatDateTime(message.sentAt)}
                      </time>
                    </div>
                  </div>

                  <div className="mt-3">
                    {message.bodyHtml ? (
                      <div
                        className="email-body"
                        dangerouslySetInnerHTML={{ __html: message.bodyHtml }}
                      />
                    ) : (
                      <p className="text-sm text-[var(--text-muted)]">
                        （本文を取得できませんでした）
                      </p>
                    )}

                    {message.quotedHtml && <QuotedBody html={message.quotedHtml} />}
                  </div>

                  {attachments.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-2.5">
                      {attachments.map((a, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2 py-1 text-[11px] text-[var(--text-muted)]"
                          title="添付ファイルの中身は Gmail で開いてください"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
                            <path
                              d="M21.4 11.05 12.25 20.2a5.5 5.5 0 0 1-7.78-7.78l9.19-9.19a3.67 3.67 0 1 1 5.19 5.19l-9.2 9.19a1.83 1.83 0 1 1-2.59-2.6l8.49-8.48"
                              stroke="currentColor"
                              strokeWidth="1.7"
                              strokeLinecap="round"
                            />
                          </svg>
                          {a.filename}
                          {a.size > 0 && (
                            <span className="opacity-70">{formatBytes(a.size)}</span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <ReplyComposer
          ticketId={ticket.id}
          contactEmail={ticket.contact.email}
          contactName={ticket.contact.name || ticket.contact.email}
          agents={agentOptions}
          defaultAgentId={meId}
          demo={demo}
        />
      </div>

      {/* 右カラム: 操作履歴 */}
      <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] p-4 xl:flex">
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            顧客情報
          </h2>
          <div className="mt-2 space-y-1 text-sm">
            <p className="font-medium">{ticket.contact.name ?? "（名前未登録）"}</p>
            <p className="break-all text-xs text-[var(--text-muted)]">
              {ticket.contact.email}
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              初回の問い合わせ: {formatDateTime(ticket.firstMessageAt)}
            </p>
          </div>

          {contactTicketCount > 1 && (
            <p className="mt-2 text-xs text-[var(--text-muted)]">
              この顧客とは他に {contactTicketCount - 1} 件の案件があります。
            </p>
          )}

          <Link
            href={`/contacts/${ticket.contactId}`}
            className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-medium transition hover:bg-[var(--surface-2)]"
          >
            この顧客との全やり取りを時系列で見る
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="m9 6 6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </section>

        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            操作履歴
          </h2>
          <ol className="mt-2 space-y-2.5">
            {ticket.activities.map((activity) => {
              const detail = parseJson<Record<string, unknown>>(activity.detailJson, {});
              const actorName = activity.actor?.name ?? activity.actorLabel ?? "不明";

              return (
                <li key={activity.id} className="flex gap-2 text-xs">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--color-ink-300)]" />
                  <div className="min-w-0">
                    <p className="leading-snug">
                      <span className="font-medium">
                        {ACTIVITY_LABELS[activity.type] ?? activity.type}
                      </span>
                      {detail.from !== undefined && detail.to !== undefined && (
                        <span className="text-[var(--text-muted)]">
                          {" "}
                          {String(detail.from)} → {String(detail.to)}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      {actorName} · {formatDateTime(activity.createdAt)}
                    </p>
                  </div>
                </li>
              );
            })}
            {ticket.activities.length === 0 && (
              <li className="text-xs text-[var(--text-muted)]">履歴はまだありません。</li>
            )}
          </ol>
        </section>
      </aside>
    </div>
  );
}
