"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import type { AgentOption } from "./MessageAuthorPicker";

type Mode = "reply" | "note";

export function ReplyComposer({
  ticketId,
  contactEmail,
  agents,
  defaultAgentId,
  demo = false,
}: {
  ticketId: number;
  contactEmail: string;
  agents: AgentOption[];
  defaultAgentId: string | null;
  /** デモモード（実際には送信されない）かどうか */
  demo?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("reply");
  const [body, setBody] = useState("");
  const [authorId, setAuthorId] = useState(defaultAgentId ?? "");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const author = agents.find((a) => a.id === authorId) ?? null;

  const submit = async () => {
    if (!body.trim()) return;
    setSending(true);
    setError(null);

    try {
      const url =
        mode === "reply"
          ? `/api/tickets/${ticketId}/reply`
          : `/api/tickets/${ticketId}/notes`;

      const payload =
        mode === "reply"
          ? { body, authorAgentId: authorId || undefined, includeSignature }
          : { body, authorId: authorId || undefined };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      setBody("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const isNote = mode === "note";

  return (
    <div
      className={`border-t border-[var(--border)] p-3 ${
        isNote ? "bg-amber-50 dark:bg-amber-950/30" : "bg-[var(--surface)]"
      }`}
    >
      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          onClick={() => setMode("reply")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            !isNote
              ? "bg-brand-600 text-white"
              : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
          }`}
        >
          顧客に返信
        </button>
        <button
          type="button"
          onClick={() => setMode("note")}
          className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
            isNote
              ? "bg-amber-500 text-white"
              : "text-[var(--text-muted)] hover:bg-[var(--surface-2)]"
          }`}
        >
          社内メモ
        </button>

        <span className="ml-auto text-[11px] text-[var(--text-muted)]">
          {isNote
            ? "顧客には送信されません"
            : demo
              ? `宛先: ${contactEmail}（デモのため実際には送信されません）`
              : `宛先: ${contactEmail}`}
        </span>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") void submit();
        }}
        rows={5}
        placeholder={
          isNote
            ? "対応の経緯や引き継ぎ事項をメモ（顧客には見えません）"
            : "返信を入力…　⌘/Ctrl + Enter で送信"
        }
        className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm leading-relaxed outline-none transition focus:border-brand-500"
      />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          {author && <Avatar name={author.name} color={author.color} size={22} />}
          <select
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs outline-none focus:border-brand-500"
            aria-label="送信者"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} として{isNote ? "記録" : "送信"}
              </option>
            ))}
          </select>
        </div>

        {!isNote && (
          <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-muted)]">
            <input
              type="checkbox"
              checked={includeSignature}
              onChange={(e) => setIncludeSignature(e.target.checked)}
              className="accent-brand-600"
            />
            署名に名前を入れる
          </label>
        )}

        {error && (
          <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
        )}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={sending || !body.trim()}
          className={`ml-auto rounded-lg px-4 py-1.5 text-xs font-medium text-white transition disabled:opacity-50 ${
            isNote ? "bg-amber-500 hover:bg-amber-600" : "bg-brand-600 hover:bg-brand-700"
          }`}
        >
          {sending ? "送信中…" : isNote ? "メモを保存" : "返信を送信"}
        </button>
      </div>

      {!isNote && (
        <p className="mt-1.5 text-[11px] leading-snug text-[var(--text-muted)]">
          ここから送信すると、送信者が「{author?.name ?? "未選択"}」として確実に記録されます。
          {demo && " デモモードのため、メールは実際には送られず記録だけが残ります。"}
        </p>
      )}
    </div>
  );
}
