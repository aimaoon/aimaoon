"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";

type Agent = {
  id: string;
  name: string;
  email: string | null;
  color: string;
  isMe: boolean;
  messageCount: number;
  signature: string | null;
};

type Rule = {
  id: string;
  kind: string;
  pattern: string;
  source: string;
  agent: { id: string; name: string; color: string };
};

const KIND_LABELS: Record<string, string> = {
  DELEGATE_EMAIL: "委任送信のアドレス",
  FROM_NAME: "送信者名に含まれる文字",
  SIGNATURE_CONTAINS: "署名に含まれる文字",
};

const KIND_HELP: Record<string, string> = {
  DELEGATE_EMAIL:
    "Gmail の「アカウントの委任」で共有アドレスに入っている人の、個人のメールアドレス。最も確実に判別できます。",
  FROM_NAME:
    "「サポート 山田 <support@…>」のように差出人名を出し分けている場合の、名前の一部。",
  SIGNATURE_CONTAINS:
    "本文の署名に必ず入る文字列（氏名など）。委任送信を使っていない場合の判別に使います。",
};

export function SettingsClient({
  agents,
  rules,
}: {
  agents: Agent[];
  rules: Rule[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentEmail, setNewAgentEmail] = useState("");

  /** 署名を編集中の担当者 ID と、その下書き */
  const [editingSignature, setEditingSignature] = useState<string | null>(null);
  const [signatureDraft, setSignatureDraft] = useState("");

  const [ruleKind, setRuleKind] = useState("SIGNATURE_CONTAINS");
  const [rulePattern, setRulePattern] = useState("");
  const [ruleAgentId, setRuleAgentId] = useState(agents[0]?.id ?? "");

  const call = async (
    url: string,
    options: RequestInit,
    onSuccess: (data: unknown) => void
  ) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(url, options);
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      onSuccess(json.data);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const addAgent = () =>
    call(
      "/api/agents",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAgentName, email: newAgentEmail || null }),
      },
      () => {
        setNotice(`${newAgentName} を追加しました。`);
        setNewAgentName("");
        setNewAgentEmail("");
      }
    );

  const removeAgent = (agent: Agent) => {
    if (
      !confirm(
        `${agent.name} を削除しますか？\nメールの履歴は残りますが、この担当者との紐付けは外れます。`
      )
    ) {
      return;
    }
    return call(`/api/agents/${agent.id}`, { method: "DELETE" }, () => {
      setNotice(`${agent.name} を削除しました。`);
    });
  };

  const openSignature = (agent: Agent) => {
    setEditingSignature(agent.id);
    setSignatureDraft(agent.signature ?? "");
    setNotice(null);
    setError(null);
  };

  const saveSignature = (agent: Agent) =>
    call(
      `/api/agents/${agent.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signature: signatureDraft }),
      },
      (data) => {
        const learned = (data as { learned?: string[] }).learned ?? [];
        setNotice(
          signatureDraft.trim()
            ? `${agent.name} の署名を保存しました。` +
              (learned.length > 0
                ? `署名に含まれる「${learned[0]}」を判別ルールに登録したので、Gmail から直接返信した分も自動で ${agent.name} と判別されます。`
                : "")
            : `${agent.name} の署名を削除しました。以後は氏名だけが付きます。`
        );
        setEditingSignature(null);
      }
    );

  const addRule = () =>
    call(
      "/api/rules",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: ruleKind,
          pattern: rulePattern,
          agentId: ruleAgentId,
        }),
      },
      (data) => {
        const count = (data as { reattributed: number }).reattributed;
        setNotice(
          count > 0
            ? `ルールを追加し、過去のメール ${count} 件の送信者を更新しました。`
            : "ルールを追加しました。"
        );
        setRulePattern("");
      }
    );

  const removeRule = (rule: Rule) =>
    call(`/api/rules/${rule.id}`, { method: "DELETE" }, (data) => {
      const count = (data as { reattributed: number }).reattributed;
      setNotice(
        count > 0
          ? `ルールを削除し、メール ${count} 件の送信者を見直しました。`
          : "ルールを削除しました。"
      );
    });

  const inputClass =
    "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition focus:border-brand-500";

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <header className="mb-8">
        <h1 className="text-xl font-semibold">担当者と判別ルール</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-muted)]">
          共有アドレスから送られた返信は、From が全員同じになるため
          「誰が送ったか」が分かりません。ここで担当者と判別ルールを登録しておくと、
          Gmail から直接返信された分も自動で送信者を見分けられるようになります。
        </p>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          {notice}
        </div>
      )}

      {/* 担当者 */}
      <section className="mb-10">
        <h2 className="mb-3 text-sm font-semibold">担当者</h2>

        <ul className="mb-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
          {agents.map((agent) => (
            <li key={agent.id} className="px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={agent.name} color={agent.color} size={30} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {agent.name}
                    {agent.isMe && (
                      <span className="ml-2 rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700 dark:bg-ink-700 dark:text-brand-200">
                        ログイン中
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-[var(--text-muted)]">
                    {agent.email ?? "個人アドレス未登録"} · 返信 {agent.messageCount} 通
                    {agent.signature ? " · 署名あり" : " · 署名未設定"}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    editingSignature === agent.id
                      ? setEditingSignature(null)
                      : openSignature(agent)
                  }
                  className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs transition hover:bg-[var(--surface-2)]"
                >
                  {editingSignature === agent.id ? "閉じる" : "署名を編集"}
                </button>

                {!agent.isMe && (
                  <button
                    type="button"
                    onClick={() => void removeAgent(agent)}
                    disabled={busy}
                    className="rounded-lg px-2.5 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
                  >
                    削除
                  </button>
                )}
              </div>

              {/* 署名の編集 */}
              {editingSignature === agent.id && (
                <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
                  <label
                    htmlFor={`sig-${agent.id}`}
                    className="text-xs font-medium"
                  >
                    {agent.name} の署名
                  </label>
                  <p className="mt-1 mb-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
                    このアプリから返信するとき、本文の末尾にそのまま付きます。
                    区切り線は署名に含めてください（こちらでは足しません）。
                    URL は自動でリンクになります。
                  </p>
                  <textarea
                    id={`sig-${agent.id}`}
                    value={signatureDraft}
                    onChange={(e) => setSignatureDraft(e.target.value)}
                    rows={12}
                    spellCheck={false}
                    placeholder={"＊＊＊＊＊＊＊＊＊＊＊＊\n会社名\n氏名\n\nEmail：\nURL：\n＊＊＊＊＊＊＊＊＊＊＊＊"}
                    className="w-full resize-y rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 font-mono text-[13px] leading-relaxed outline-none transition focus:border-brand-500"
                  />

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {signatureDraft.length} 文字
                      {signatureDraft.includes(agent.name.split(/[\s\u3000]+/)[0]) &&
                        " · 氏名が含まれているので、Gmail から直接送った返信も自動判別できます"}
                    </p>
                    <button
                      type="button"
                      onClick={() => setEditingSignature(null)}
                      className="ml-auto rounded-lg px-3 py-1.5 text-xs hover:bg-[var(--surface)]"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={() => void saveSignature(agent)}
                      disabled={busy}
                      className="rounded-lg bg-brand-600 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
                    >
                      保存
                    </button>
                  </div>

                  {signatureDraft.trim() && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-[11px] text-[var(--text-muted)]">
                        送信されるプレビューを見る
                      </summary>
                      <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
                        <p className="text-[var(--text-muted)]">（返信の本文）</p>
                        <p className="mt-3 whitespace-pre-wrap leading-relaxed">
                          {signatureDraft}
                        </p>
                      </div>
                    </details>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-2 text-xs font-medium">担当者を追加</p>
          <div className="flex flex-wrap gap-2">
            <input
              value={newAgentName}
              onChange={(e) => setNewAgentName(e.target.value)}
              placeholder="名前（例: 山田 太郎）"
              className={`${inputClass} flex-1 min-w-40`}
            />
            <input
              value={newAgentEmail}
              onChange={(e) => setNewAgentEmail(e.target.value)}
              placeholder="個人のメールアドレス（任意）"
              className={`${inputClass} flex-1 min-w-52`}
            />
            <button
              type="button"
              onClick={() => void addAgent()}
              disabled={busy || !newAgentName.trim()}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              追加
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
            個人アドレスを入れておくと、Gmail の「アカウントの委任」経由で送られた返信を
            自動で判別できるようになります。
          </p>
        </div>
      </section>

      {/* ルール */}
      <section>
        <h2 className="mb-3 text-sm font-semibold">送信者の判別ルール</h2>

        {rules.length > 0 ? (
          <ul className="mb-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            {rules.map((rule) => (
              <li key={rule.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={rule.agent.name} color={rule.agent.color} size={26} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    <span className="text-[var(--text-muted)]">
                      {KIND_LABELS[rule.kind] ?? rule.kind}:
                    </span>{" "}
                    <span className="font-mono text-[13px]">{rule.pattern}</span>
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    → {rule.agent.name}
                    {rule.source === "LEARNED" && "（自動学習）"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void removeRule(rule)}
                  disabled={busy}
                  className="rounded-lg px-2.5 py-1 text-xs text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-950"
                >
                  削除
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mb-3 rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-sm text-[var(--text-muted)]">
            ルールはまだありません。
            <br />
            メールの「送信者不明」バッジから設定すると、ここに自動で追加されます。
          </p>
        )}

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="mb-2 text-xs font-medium">ルールを追加</p>
          <div className="flex flex-wrap gap-2">
            <select
              value={ruleKind}
              onChange={(e) => setRuleKind(e.target.value)}
              className={inputClass}
            >
              {Object.entries(KIND_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              value={rulePattern}
              onChange={(e) => setRulePattern(e.target.value)}
              placeholder={
                ruleKind === "DELEGATE_EMAIL" ? "taro@example.com" : "山田"
              }
              className={`${inputClass} flex-1 min-w-40`}
            />
            <select
              value={ruleAgentId}
              onChange={(e) => setRuleAgentId(e.target.value)}
              className={inputClass}
            >
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  → {agent.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void addRule()}
              disabled={busy || !rulePattern.trim() || !ruleAgentId}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              追加
            </button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--text-muted)]">
            {KIND_HELP[ruleKind]}
          </p>
          <p className="mt-1 text-[11px] text-[var(--text-muted)]">
            ルールを追加すると、過去に取り込んだメールにも遡って適用されます
            （手動で設定した分は上書きされません）。
          </p>
        </div>
      </section>
    </div>
  );
}
