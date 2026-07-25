export default function TicketsIndexPage() {
  return (
    <div className="flex h-full items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--text-muted)]">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M3 7.5A2.5 2.5 0 0 1 5.5 5h13A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 16.5v-9Z"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path d="m4 8 8 5 8-5" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </div>
        <h2 className="text-base font-medium">チケットを選択してください</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          左の一覧から会話を選ぶと、やり取りの全履歴と、
          それぞれの返信を<strong>誰が送ったか</strong>が表示されます。
        </p>
      </div>
    </div>
  );
}
