"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Avatar } from "./Avatar";
import { formatCompact, STATUS_LABELS, STATUS_COLORS } from "@/lib/format";
import { URGENCY_STYLE } from "@/lib/urgency";
import type { TicketListItem } from "@/app/api/tickets/route";

export function TicketList() {
  const params = useSearchParams();
  const routeParams = useParams<{ id?: string }>();
  const router = useRouter();

  const [items, setItems] = useState<TicketListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState(params.get("q") ?? "");
  const [, startTransition] = useTransition();

  const selectedId = routeParams?.id ? Number(routeParams.id) : null;
  const queryString = params.toString();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets?${queryString}`, { cache: "no-store" });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      setItems(json.data.items);
      setTotal(json.data.total);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  // 一覧は同期後に増えるので、定期的に取り直す
  useEffect(() => {
    const interval = setInterval(() => void load(), 15000);
    return () => clearInterval(interval);
  }, [load]);

  // 検索は入力が止まってから実行する
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = new URLSearchParams(queryString);
      const current = next.get("q") ?? "";
      if (current === query) return;
      if (query) next.set("q", query);
      else next.delete("q");
      next.delete("page");
      startTransition(() => router.replace(`/tickets?${next.toString()}`));
    }, 350);
    return () => clearTimeout(timer);
  }, [query, queryString, router]);

  return (
    <div className="flex w-[22rem] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] p-3">
        <div className="relative">
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
            <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="件名・本文・メールアドレスで検索"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] py-2 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500"
          />
        </div>
        <div className="mt-2 flex items-center gap-2 px-1">
          <p className="text-xs text-[var(--text-muted)]">
            {loading && items.length === 0 ? "読み込み中…" : `${total} 件`}
          </p>
          <label className="ml-auto flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
            並び順
            <select
              value={params.get("sort") ?? "recent"}
              onChange={(e) => {
                const next = new URLSearchParams(queryString);
                if (e.target.value === "recent") next.delete("sort");
                else next.set("sort", e.target.value);
                next.delete("page");
                router.replace(`/tickets?${next.toString()}`);
              }}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[11px] outline-none focus:border-brand-500"
            >
              <option value="recent">新着順</option>
              <option value="waiting">待たせている順</option>
            </select>
          </label>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <p className="p-4 text-sm text-red-600 dark:text-red-400">
            読み込みに失敗しました: {error}
          </p>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="p-6 text-center text-sm text-[var(--text-muted)]">
            <p>該当するチケットがありません。</p>
            <p className="mt-2 text-xs leading-relaxed">
              まだ同期していない場合は、左下の「Gmail と同期」を押してください。
            </p>
          </div>
        )}

        <ul>
          {items.map((ticket) => {
            const selected = ticket.id === selectedId;
            return (
              <li key={ticket.id}>
                <Link
                  href={`/tickets/${ticket.id}?${queryString}`}
                  className={`block border-b border-[var(--border)] px-3 py-2.5 transition ${
                    selected
                      ? "bg-brand-50 dark:bg-ink-800"
                      : "hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`truncate text-[13px] ${
                            ticket.unread ? "font-semibold" : "font-medium"
                          }`}
                        >
                          {ticket.contactName}
                        </span>
                        <span className="ml-auto shrink-0 text-[11px] tabular-nums text-[var(--text-muted)]">
                          {formatCompact(ticket.lastMessageAt)}
                        </span>
                      </div>

                      <p
                        className={`mt-0.5 truncate text-[13px] ${
                          ticket.unread ? "font-medium" : "text-[var(--text)]"
                        }`}
                      >
                        {ticket.subject}
                      </p>

                      {ticket.snippet && (
                        <p className="mt-0.5 line-clamp-1 text-xs text-[var(--text-muted)]">
                          {ticket.snippet}
                        </p>
                      )}

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <span
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                          style={{ background: STATUS_COLORS[ticket.status] }}
                        >
                          {STATUS_LABELS[ticket.status]}
                        </span>

                        <span className="text-[10px] text-[var(--text-muted)]">
                          #{ticket.id} · {ticket.messageCount}通
                        </span>

                        {ticket.awaitingReply &&
                          (ticket.urgency === "NONE" ? (
                            <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-muted)]">
                              未返信{ticket.waitingFor && ` ${ticket.waitingFor}`}
                            </span>
                          ) : (
                            <span
                              className={`urgency urgency-${ticket.urgency}`}
                              title={`${URGENCY_STYLE[ticket.urgency].describe} 顧客の最後のメールから ${ticket.waitingFor} 経過しています。`}
                            >
                              {URGENCY_STYLE[ticket.urgency].short} · 未返信 {ticket.waitingFor}
                            </span>
                          ))}

                        {ticket.multiAgent && (
                          <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                            複数人が対応
                          </span>
                        )}

                        {ticket.responders.length > 0 && (
                          <span className="ml-auto flex items-center -space-x-1">
                            {ticket.responders.slice(0, 4).map((r, i) => (
                              <Avatar
                                key={`${r.id ?? "unknown"}-${i}`}
                                name={r.name}
                                color={r.color}
                                size={17}
                                dimmed={r.id === null}
                                title={
                                  r.id === null
                                    ? "送信者が特定できていない返信があります"
                                    : `${r.name} が返信`
                                }
                              />
                            ))}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
