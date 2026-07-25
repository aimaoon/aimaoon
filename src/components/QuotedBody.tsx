"use client";

import { useState } from "react";

/** 返信に自動で付く引用履歴を折りたたんで表示する */
export function QuotedBody({ html }: { html: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 rounded border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--text-muted)] transition hover:bg-[var(--surface-2)]"
        aria-expanded={open}
      >
        <span className="font-mono leading-none">···</span>
        {open ? "引用部分を隠す" : "引用された過去のやり取りを表示"}
      </button>

      {open && (
        <div
          className="email-body email-quote mt-2 border-l-2 border-[var(--border)] pl-3"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}
