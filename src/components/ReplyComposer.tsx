"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import type { AgentOption } from "./MessageAuthorPicker";

type Action = "reply" | "note";

/**
 * 返信欄。
 *
 * モード切り替え（タブ）にはしていない。共有受信箱では
 * 「社内メモを書いているつもりで顧客に送ってしまう」事故が一番痛いので、
 * 入力欄は 1 つのまま、押したボタンでその場の動作が決まる形にしている。
 *  - 社内に残す → グレー基調の控えめなボタン（外に出ない）
 *  - 顧客に送る → 宛先を出した目立つボタン（外に出る）
 */
export function ReplyComposer({
  ticketId,
  contactEmail,
  contactName,
  agents,
  defaultAgentId,
  demo = false,
}: {
  ticketId: number;
  contactEmail: string;
  contactName: string;
  agents: AgentOption[];
  defaultAgentId: string | null;
  /** デモモード（実際には送信されない）かどうか */
  demo?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [authorId, setAuthorId] = useState(defaultAgentId ?? "");
  const [includeSignature, setIncludeSignature] = useState(true);
  const [pending, setPending] = useState<Action | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ action: Action; text: string } | null>(null);

  const author = agents.find((a) => a.id === authorId) ?? null;
  const empty = body.trim().length === 0;
  const busy = pending !== null;

  const submit = async (action: Action) => {
    if (empty || busy) return;

    setPending(action);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(
        action === "reply"
          ? `/api/tickets/${ticketId}/reply`
          : `/api/tickets/${ticketId}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "reply"
              ? { body, authorAgentId: authorId || undefined, includeSignature }
              : { body, authorId: authorId || undefined }
          ),
        }
      );
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      setBody("");
      setResult({
        action,
        text:
          action === "note"
            ? "社内メモとして保存しました。顧客には送信されていません。"
            : demo
              ? `デモのため送信はしていません。${author?.name ?? "自分"} からの返信として記録しました。`
              : `${contactName} に送信しました。送信者「${author?.name ?? "自分"}」として記録されています。`,
      });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface)] p-3">
      {result && (
        <p
          className={`mb-2 rounded-lg px-3 py-2 text-xs leading-relaxed ${
            result.action === "note"
              ? "bg-[var(--surface-2)] text-[var(--text-muted)]"
              : "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200"
          }`}
          role="status"
        >
          {result.text}
        </p>
      )}

      <label htmlFor={`composer-${ticketId}`} className="sr-only">
        本文
      </label>
      <textarea
        id={`composer-${ticketId}`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        placeholder="ここに入力し、下のボタンで「社内に残す」か「顧客に送る」を選びます"
        className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm leading-relaxed outline-none transition focus:border-brand-500"
      />

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex items-center gap-1.5">
          {author && <Avatar name={author.name} color={author.color} size={22} />}
          <select
            value={authorId}
            onChange={(e) => setAuthorId(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs outline-none focus:border-brand-500"
            aria-label="担当者"
          >
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name} として
              </option>
            ))}
          </select>
        </div>

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={includeSignature}
            onChange={(e) => setIncludeSignature(e.target.checked)}
            className="accent-brand-600"
          />
          返信の署名に名前を入れる
        </label>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {/* 社内に残す — 外に出ない操作なので控えめに */}
          <button
            type="button"
            onClick={() => void submit("note")}
            disabled={empty || busy}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs font-medium text-[var(--text)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 4.5h11l3.5 3.5v11a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path d="M7.5 4.5v5h7M7.5 16h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
            {pending === "note" ? "保存中…" : "社内メモに残す"}
          </button>

          {/* 顧客に送る — 外に出る操作なので宛先を明示する */}
          <button
            type="button"
            onClick={() => void submit("reply")}
            disabled={empty || busy}
            className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 12 20 4l-7 16-2.5-6.5L4 12Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
            </svg>
            {pending === "reply" ? "送信中…" : `${contactName} に返信を送信`}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
        <strong className="font-medium text-[var(--text)]">社内メモに残す</strong>
        …このアプリ内にだけ記録され、顧客には届きません。
        <span className="mx-1.5 opacity-40">|</span>
        <strong className="font-medium text-[var(--text)]">返信を送信</strong>
        …{demo ? "本番では " : ""}
        {contactEmail} にメールを送り、送信者を記録します。
        {demo && "（デモモードでは実際には送信されません）"}
      </p>
    </div>
  );
}
