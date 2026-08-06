import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/Avatar";
import { QuotedBody } from "@/components/QuotedBody";
import { loadContactTimeline, TIMELINE_LIMIT } from "@/lib/contact-timeline";
import { METHOD_LABELS } from "@/lib/attribution";
import {
  formatDateTime,
  formatRelative,
  STATUS_COLORS,
  STATUS_LABELS,
} from "@/lib/format";

export const dynamic = "force-dynamic";

/** 案件ごとに色を振り、時系列の中でも「どの件か」が一目で分かるようにする */
const TICKET_HUES = [
  "#2a56c4", "#0f8a6a", "#b4530a", "#8b2fa8",
  "#0d7490", "#a8323c", "#4c6b16", "#6b4bd6",
];
function hueFor(ticketId: number) {
  return TICKET_HUES[ticketId % TICKET_HUES.length];
}

export default async function ContactPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const { view } = await searchParams;
  const grouped = view === "tickets";

  const contact = await prisma.contact.findUnique({ where: { id } });
  if (!contact) notFound();

  const data = await loadContactTimeline(id);
  if (!data) notFound();

  const { entries, summary } = data;

  const tickets = await prisma.ticket.findMany({
    where: { contactId: id },
    include: { assignee: { select: { name: true, color: true } } },
    orderBy: { lastMessageAt: "desc" },
  });

  const displayName = contact.name || contact.email;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <Link
          href="/contacts"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m15 18-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          顧客一覧
        </Link>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-6">
        {/* ── 顧客の概要 ────────────────────────────────────── */}
        <header className="flex items-start gap-3">
          <Avatar name={displayName} color="#4d5566" size={44} />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold">{displayName}</h1>
            <p className="mt-0.5 break-all text-sm text-[var(--text-muted)]">
              {contact.email}
              {contact.company && ` · ${contact.company}`}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {summary.firstAt && `初回 ${formatDateTime(summary.firstAt)}`}
              {summary.lastAt && ` · 最終 ${formatRelative(summary.lastAt)}`}
            </p>
          </div>
        </header>

        <div className="mt-4 flex flex-wrap gap-2">
          {[
            { label: "案件", value: `${summary.ticketCount} 件` },
            { label: "対応中", value: `${summary.openCount} 件` },
            { label: "未返信", value: `${summary.awaitingCount} 件` },
            {
              label: "メール",
              value: `${summary.messageCount} 通（受信 ${summary.inboundCount} / 送信 ${summary.outboundCount}）`,
            },
          ].map((stat) => (
            <span
              key={stat.label}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
            >
              <span className="text-[var(--text-muted)]">{stat.label} </span>
              <strong className="font-semibold tabular-nums">{stat.value}</strong>
            </span>
          ))}
        </div>

        {/* ── この顧客に返信した人 ──────────────────────────── */}
        {summary.responders.length > 0 && (
          <section className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5">
            <h2 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
              この顧客に返信した人（全案件の合計）
            </h2>
            <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-2">
              {summary.responders.map((r, i) => (
                <span key={i} className="flex items-center gap-2 text-sm">
                  <Avatar name={r.name} color={r.color} size={22} dimmed={r.unknown} />
                  <span className={r.unknown ? "text-[var(--text-muted)]" : ""}>
                    {r.name}
                  </span>
                  <span className="text-xs tabular-nums text-[var(--text-muted)]">
                    {r.count}通
                  </span>
                </span>
              ))}
            </div>
          </section>
        )}

        {/* ── 表示切替 ──────────────────────────────────────── */}
        <div className="mt-6 flex items-center gap-1 border-b border-[var(--border)]">
          {[
            { key: "", label: "すべて時系列", hint: "別件も混ぜて時間順" },
            { key: "tickets", label: "案件ごと", hint: "スレッド単位でまとめる" },
          ].map((tab) => {
            const active = tab.key === "tickets" ? grouped : !grouped;
            return (
              <Link
                key={tab.key || "timeline"}
                href={`/contacts/${id}${tab.key ? `?view=${tab.key}` : ""}`}
                title={tab.hint}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                  active
                    ? "border-brand-600 font-medium text-brand-600"
                    : "border-transparent text-[var(--text-muted)] hover:text-[var(--text)]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>

        {grouped ? (
          /* ── 案件ごと ───────────────────────────────────── */
          <ul className="mt-4 space-y-2">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/tickets/${ticket.id}`}
                  className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 transition hover:bg-[var(--surface-2)]"
                  style={{ borderLeftColor: hueFor(ticket.id), borderLeftWidth: 3 }}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                      style={{ background: STATUS_COLORS[ticket.status] }}
                    >
                      {STATUS_LABELS[ticket.status]}
                    </span>
                    <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                      #{ticket.id} · {ticket.messageCount}通
                    </span>
                    {ticket.awaitingReply && (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                        未返信
                      </span>
                    )}
                    {ticket.multiAgent && (
                      <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                        複数人が対応
                      </span>
                    )}
                    <span className="ml-auto text-[11px] text-[var(--text-muted)]">
                      {formatRelative(ticket.lastMessageAt)}
                    </span>
                  </div>
                  <p className="mt-1.5 font-medium">{ticket.subject}</p>
                  {ticket.assignee && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                      <Avatar
                        name={ticket.assignee.name}
                        color={ticket.assignee.color}
                        size={16}
                      />
                      担当 {ticket.assignee.name}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          /* ── すべて時系列（別件が混ざる）─────────────────── */
          <>
            <p className="mt-4 rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs leading-relaxed text-[var(--text-muted)]">
              この顧客とのやり取りを、<strong className="text-[var(--text)]">案件をまたいで</strong>
              古い順に並べています。左端の色と件名タグで、どの案件のメールかが分かります。
            </p>

            {summary.truncated && (
              <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
                やり取りが多いため、直近 {TIMELINE_LIMIT} 件のみ表示しています。
                古い分は「案件ごと」から各チケットを開いてご確認ください。
              </p>
            )}

            <ol className="mt-4 space-y-2.5">
              {entries.map((entry) => {
                const hue = hueFor(entry.ticketId);
                const inbound = entry.direction === "INBOUND";
                const isNote = entry.kind === "note";

                return (
                  <li
                    key={`${entry.kind}-${entry.id}`}
                    className={`rounded-xl border p-3 ${
                      isNote
                        ? "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40"
                        : inbound
                          ? "border-[var(--border)] bg-[var(--surface)]"
                          : "border-brand-200 bg-brand-50 dark:border-ink-700 dark:bg-ink-800"
                    }`}
                    style={{ borderLeftColor: hue, borderLeftWidth: 3 }}
                  >
                    {/* どの案件か */}
                    <Link
                      href={`/tickets/${entry.ticketId}`}
                      className="inline-flex max-w-full items-center gap-1.5 rounded px-1.5 py-0.5 text-[11px] transition hover:underline"
                      style={{ background: `${hue}1a`, color: hue }}
                    >
                      <span className="tabular-nums">#{entry.ticketId}</span>
                      <span className="truncate">{entry.ticketSubject}</span>
                    </Link>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Avatar
                        name={entry.personName}
                        color={entry.personColor}
                        size={24}
                        dimmed={entry.unknownSender}
                      />
                      <span className="text-sm font-medium">{entry.personName}</span>
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {isNote
                          ? "社内メモ"
                          : inbound
                            ? "お客様"
                            : "自社からの返信"}
                      </span>

                      {entry.attributionMethod && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            entry.unknownSender
                              ? "border border-dashed border-amber-500 bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
                              : "bg-[var(--surface-2)] text-[var(--text-muted)]"
                          }`}
                          title={METHOD_LABELS[entry.attributionMethod]?.detail}
                        >
                          {METHOD_LABELS[entry.attributionMethod]?.label ??
                            entry.attributionMethod}
                        </span>
                      )}

                      <time
                        className="ml-auto text-[11px] tabular-nums text-[var(--text-muted)]"
                        dateTime={entry.at.toISOString()}
                      >
                        {formatDateTime(entry.at)}
                      </time>
                    </div>

                    <div className="mt-2">
                      {entry.bodyHtml ? (
                        <div
                          className="email-body"
                          dangerouslySetInnerHTML={{ __html: entry.bodyHtml }}
                        />
                      ) : (
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">
                          {entry.bodyText ?? "（本文なし）"}
                        </p>
                      )}
                      {entry.quotedHtml && <QuotedBody html={entry.quotedHtml} />}
                    </div>

                    {entry.hasAttachments && (
                      <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                        添付ファイルあり
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>

            {entries.length === 0 && (
              <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
                この顧客とのやり取りはまだありません。
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
