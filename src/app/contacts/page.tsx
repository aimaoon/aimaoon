import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { Avatar } from "@/components/Avatar";
import { listContacts } from "@/lib/contact-timeline";
import { formatRelative } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { q = "" } = await searchParams;
  const contacts = await listContacts(q);

  return (
    <div className="min-h-screen">
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <Link
          href="/tickets"
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
          チケット一覧に戻る
        </Link>
      </div>

      <div className="mx-auto max-w-3xl px-5 py-7">
        <header className="mb-5">
          <h1 className="text-xl font-semibold">顧客一覧</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">
            顧客を選ぶと、その人との<strong>全案件のやり取りを時系列</strong>で確認できます。
            自分が送った分と、他の人が別件で返した分がまとめて 1 本の流れになります。
          </p>
        </header>

        <form method="get" className="mb-4">
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
              <path
                d="m20 20-3.5-3.5"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="名前・メールアドレス・会社名で検索"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-9 pr-3 text-sm outline-none transition focus:border-brand-500"
            />
          </div>
        </form>

        <p className="mb-2 px-1 text-xs text-[var(--text-muted)]">{contacts.length} 人</p>

        {contacts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-10 text-center text-sm text-[var(--text-muted)]">
            {q
              ? "該当する顧客が見つかりませんでした。"
              : "顧客はまだいません。Gmail と同期すると自動で登録されます。"}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {contacts.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/contacts/${c.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-[var(--surface-2)]"
                >
                  <Avatar name={c.name || c.email} color="#4d5566" size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{c.name || c.email}</p>
                    <p className="truncate text-xs text-[var(--text-muted)]">
                      {c.email}
                      {c.company && ` · ${c.company}`}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <span className="text-[11px] tabular-nums text-[var(--text-muted)]">
                        案件 {c.ticketCount}件
                      </span>
                      {c.awaitingCount > 0 && (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
                          未返信 {c.awaitingCount}
                        </span>
                      )}
                      {c.multiAgent && (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950 dark:text-violet-300">
                          複数人が対応
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    {c.lastAt && (
                      <span className="text-[11px] text-[var(--text-muted)]">
                        {formatRelative(c.lastAt)}
                      </span>
                    )}
                    <span className="flex -space-x-1">
                      {c.responders.slice(0, 4).map((r, i) => (
                        <Avatar
                          key={i}
                          name={r.name}
                          color={r.color}
                          size={18}
                          dimmed={r.unknown}
                          title={r.unknown ? "送信者が特定できていない返信があります" : r.name}
                        />
                      ))}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
