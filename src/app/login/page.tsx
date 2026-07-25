import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { checkConfig } from "@/lib/env";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await getSession().catch(() => null);
  if (session) redirect("/tickets");

  const { error } = await searchParams;
  const config = checkConfig();

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-sm">
          <div className="mb-6">
            <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Z"
                  stroke="currentColor"
                  strokeWidth="1.7"
                />
                <path d="m4 8 8 5 8-5" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold">メールチケット管理</h1>
            <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">
              Gmail の問い合わせをチケットとして整理します。
              共有アドレスから<strong>誰が返信したか</strong>を 1 通ずつ記録するので、
              自分が休みの日に別の人が対応した分もあとから追えます。
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              {error}
            </div>
          )}

          {config.ok ? (
            <a
              href="/api/auth/login"
              className="flex w-full items-center justify-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm font-medium transition hover:bg-[var(--surface-2)]"
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
                <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.1-3.8 6.6-9.4 6.6-16.1Z" />
                <path fill="#34A853" d="M24 46c5.9 0 10.9-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8.1 41.1 15.5 46 24 46Z" />
                <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5A22 22 0 0 0 2 24c0 3.6.9 6.9 2.5 9.9l7.3-5.7Z" />
                <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C34.9 4.1 29.9 2 24 2 15.5 2 8.1 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9Z" />
              </svg>
              Google でログイン
            </a>
          ) : (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
              <p className="font-medium">セットアップが未完了です</p>
              <p className="mt-1">
                次の環境変数が設定されていません:
                <br />
                <code className="font-mono text-xs">{config.missing.join(", ")}</code>
              </p>
              <p className="mt-2">
                README.md の「セットアップ手順」に従って <code className="font-mono text-xs">.env</code> を作成してください。
              </p>
            </div>
          )}

          <p className="mt-6 text-xs leading-relaxed text-[var(--text-muted)]">
            メールの読み取りと送信のために Gmail へのアクセスを求めます。
            取得したデータはあなたのパソコン内の SQLite ファイルにのみ保存され、外部には送信されません。
          </p>
        </div>
      </div>
    </main>
  );
}
