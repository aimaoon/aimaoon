"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Avatar } from "./Avatar";
import { SyncButton } from "./SyncButton";
import { STATUS_LABELS } from "@/lib/format";

export type SidebarAgent = { id: string; name: string; color: string; isMe: boolean };

export type SidebarCounts = {
  byStatus: Record<string, number>;
  awaiting: number;
  multiAgent: number;
  unknownSender: number;
  all: number;
};

function buildHref(
  current: URLSearchParams,
  patch: Record<string, string | null>
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  next.delete("page");
  const qs = next.toString();
  return `/tickets${qs ? `?${qs}` : ""}`;
}

function NavItem({
  href,
  active,
  label,
  count,
  accent,
  icon,
}: {
  href: string;
  active: boolean;
  label: string;
  count?: number;
  accent?: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2.5 rounded-lg px-3 py-[7px] text-sm transition ${
        active
          ? "bg-brand-600 text-white"
          : "text-[var(--text)] hover:bg-[var(--surface-2)]"
      }`}
    >
      {accent && !icon && (
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: active ? "rgba(255,255,255,.85)" : accent }}
        />
      )}
      {icon}
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span
          className={`shrink-0 text-xs tabular-nums ${
            active ? "text-white/80" : "text-[var(--text-muted)]"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}

export function Sidebar({
  counts,
  agents,
  accountEmail,
  demo = false,
}: {
  counts: SidebarCounts;
  agents: SidebarAgent[];
  accountEmail: string;
  /** デモモード中は Gmail 同期ボタンを出さない */
  demo?: boolean;
}) {
  const params = useSearchParams();
  const pathname = usePathname();

  const status = params.get("status") ?? "OPEN";
  const view = params.get("view") ?? "";
  const assignee = params.get("assignee") ?? "";

  const isStatusActive = (value: string) => !view && !assignee && status === value;

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-white">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Z"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path d="m4 8 8 5 8-5" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </span>
        <span className="truncate text-sm font-semibold">チケット管理</span>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          ステータス
        </p>
        {(["OPEN", "PENDING", "SOLVED", "CLOSED"] as const).map((s) => (
          <NavItem
            key={s}
            href={buildHref(params, { status: s, view: null, assignee: null })}
            active={isStatusActive(s)}
            label={STATUS_LABELS[s]}
            count={counts.byStatus[s] ?? 0}
            accent={
              { OPEN: "#c2410c", PENDING: "#a16207", SOLVED: "#15803d", CLOSED: "#64748b" }[s]
            }
          />
        ))}
        <NavItem
          href={buildHref(params, { status: "ALL", view: null, assignee: null })}
          active={isStatusActive("ALL")}
          label="すべて"
          count={counts.all}
          accent="#94a3b8"
        />

        <p className="mt-4 px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          絞り込み
        </p>
        <NavItem
          href={buildHref(params, { view: "awaiting", status: "ALL", assignee: null })}
          active={view === "awaiting"}
          label="未返信"
          count={counts.awaiting}
          accent="#dc2626"
        />
        <NavItem
          href={buildHref(params, { view: "multiAgent", status: "ALL", assignee: null })}
          active={view === "multiAgent"}
          label="複数人が対応"
          count={counts.multiAgent}
          accent="#7c3aed"
        />
        <NavItem
          href={buildHref(params, { view: "unknownSender", status: "ALL", assignee: null })}
          active={view === "unknownSender"}
          label="送信者不明あり"
          count={counts.unknownSender}
          accent="#8892a3"
        />

        <p className="mt-4 px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
          担当者
        </p>
        <NavItem
          href={buildHref(params, { assignee: "unassigned", status: "ALL", view: null })}
          active={assignee === "unassigned"}
          label="未割り当て"
          accent="#94a3b8"
        />
        {agents.map((agent) => (
          <NavItem
            key={agent.id}
            href={buildHref(params, { assignee: agent.id, status: "ALL", view: null })}
            active={assignee === agent.id}
            label={agent.isMe ? `${agent.name}（自分）` : agent.name}
            icon={<Avatar name={agent.name} color={agent.color} size={18} />}
          />
        ))}
      </nav>

      <div className="border-t border-[var(--border)] p-2">
        {demo ? (
          <p className="px-3 py-2 text-[11px] leading-snug text-[var(--text-muted)]">
            デモモードのため Gmail 同期は行いません。
          </p>
        ) : (
          <SyncButton />
        )}
        <Link
          href="/contacts"
          className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--surface-2)] ${
            pathname.startsWith("/contacts") ? "bg-[var(--surface-2)] font-medium" : ""
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
            <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          顧客一覧
        </Link>
        <Link
          href="/settings"
          className={`mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--surface-2)] ${
            pathname === "/settings" ? "bg-[var(--surface-2)] font-medium" : ""
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
            <path
              d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1 1.56V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.56-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.56V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9v.09a1.7 1.7 0 0 0 1.56 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
          担当者・判別ルール
        </Link>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="mt-1 w-full truncate rounded-lg px-3 py-2 text-left text-xs text-[var(--text-muted)] transition hover:bg-[var(--surface-2)]"
            title={`${accountEmail} からログアウト`}
          >
            {accountEmail} · ログアウト
          </button>
        </form>
      </div>
    </aside>
  );
}
