"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PRIORITY_LABELS, STATUS_LABELS } from "@/lib/format";
import type { AgentOption } from "./MessageAuthorPicker";

export function TicketControls({
  ticketId,
  status,
  priority,
  assigneeId,
  agents,
}: {
  ticketId: number;
  status: string;
  priority: string;
  assigneeId: string | null;
  agents: AgentOption[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/tickets/${ticketId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const selectClass =
    "rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs outline-none transition focus:border-brand-500 disabled:opacity-60";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={status}
        disabled={saving}
        onChange={(e) => void patch({ status: e.target.value })}
        className={selectClass}
        aria-label="ステータス"
      >
        {Object.entries(STATUS_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>

      <select
        value={priority}
        disabled={saving}
        onChange={(e) => void patch({ priority: e.target.value })}
        className={selectClass}
        aria-label="優先度"
      >
        {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            優先度: {label}
          </option>
        ))}
      </select>

      <select
        value={assigneeId ?? ""}
        disabled={saving}
        onChange={(e) => void patch({ assigneeId: e.target.value || null })}
        className={selectClass}
        aria-label="担当者"
      >
        <option value="">担当者: 未割り当て</option>
        {agents.map((agent) => (
          <option key={agent.id} value={agent.id}>
            担当: {agent.name}
          </option>
        ))}
      </select>

      {error && <span className="text-xs text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
