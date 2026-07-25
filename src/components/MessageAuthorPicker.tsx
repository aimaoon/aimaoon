"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";
import { METHOD_LABELS } from "@/lib/attribution";

export type AgentOption = { id: string; name: string; color: string };

const PANEL_WIDTH = 320;

/**
 * 送信メール 1 通の「実際の送信者」を表示し、必要なら手動で直す。
 * 直すときに署名キーワードを一緒に登録すると、次回から自動判別されるようになる。
 */
export function MessageAuthorPicker({
  messageId,
  currentAgent,
  method,
  agents,
  signatureSuggestions,
}: {
  messageId: string;
  currentAgent: AgentOption | null;
  method: string;
  agents: AgentOption[];
  signatureSuggestions: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState(currentAgent?.id ?? "");
  const [signature, setSignature] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // スクロール領域の中にあるので、position:fixed で切り取られないようにする。
  // 下に収まらない場合はボタンの上側に開く。
  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    const place = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 320;

      const left = Math.max(
        8,
        Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8)
      );
      const below = rect.bottom + 6;
      const top =
        below + panelHeight > window.innerHeight - 8
          ? Math.max(8, rect.top - panelHeight - 6)
          : below;

      setPosition({ top, left });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, selected, signature, message, error]);

  const info = METHOD_LABELS[method] ?? METHOD_LABELS.UNKNOWN;
  const isUnknown = !currentAgent;
  const locked = method === "APP";

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/messages/${messageId}/author`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selected || null,
          learnSignature: signature || undefined,
        }),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);

      const notes: string[] = json.data.learned ?? [];
      setMessage(
        notes.length > 0
          ? `${notes.join("。")}${
              json.data.reattributed > 0
                ? `（過去のメール ${json.data.reattributed} 件も更新しました）`
                : ""
            }`
          : "送信者を設定しました。"
      );
      router.refresh();
      setTimeout(() => setOpen(false), 1800);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !locked && setOpen((v) => !v)}
        disabled={locked}
        title={info.detail}
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] transition ${
          isUnknown
            ? "border border-dashed border-amber-500 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-200"
            : "bg-[var(--surface-2)] text-[var(--text-muted)] hover:bg-[var(--border)]"
        } ${locked ? "cursor-default" : "cursor-pointer"}`}
      >
        {method === "APP" && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m5 13 4 4L19 7"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        {info.label}
        {!locked && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m6 9 6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              width: PANEL_WIDTH,
              top: position?.top ?? -9999,
              left: position?.left ?? -9999,
              visibility: position ? "visible" : "hidden",
            }}
            className="z-50 max-h-[80vh] overflow-y-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl"
          >
            <p className="text-xs font-medium">この返信を送ったのは誰ですか？</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">
              {info.detail}
            </p>

            <div className="mt-2.5 max-h-44 space-y-0.5 overflow-y-auto">
              {agents.map((agent) => (
                <label
                  key={agent.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--surface-2)]"
                >
                  <input
                    type="radio"
                    name={`author-${messageId}`}
                    checked={selected === agent.id}
                    onChange={() => setSelected(agent.id)}
                    className="accent-brand-600"
                  />
                  <Avatar name={agent.name} color={agent.color} size={20} />
                  <span className="truncate">{agent.name}</span>
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-[var(--surface-2)]">
                <input
                  type="radio"
                  name={`author-${messageId}`}
                  checked={selected === ""}
                  onChange={() => setSelected("")}
                  className="accent-brand-600"
                />
                <Avatar name="?" dimmed size={20} />
                <span className="text-[var(--text-muted)]">不明のままにする</span>
              </label>
            </div>

            {selected && signatureSuggestions.length > 0 && (
              <div className="mt-2.5 border-t border-[var(--border)] pt-2.5">
                <p className="text-[11px] font-medium">
                  次回から自動判別する（任意）
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-[var(--text-muted)]">
                  署名に必ず入る文字列を選ぶと、同じ人の返信を自動で見分けます。
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {signatureSuggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSignature(signature === s ? "" : s)}
                      className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                        signature === s
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-[var(--border)] hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{error}</p>
            )}
            {message && (
              <p className="mt-2 text-[11px] text-green-700 dark:text-green-400">{message}</p>
            )}

            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-1.5 text-xs hover:bg-[var(--surface-2)]"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
