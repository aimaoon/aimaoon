"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRelative } from "@/lib/format";

type SyncStatus = {
  running: boolean;
  initialDone: boolean;
  importedCount: number;
  progressNote: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
};

export function SyncButton() {
  const router = useRouter();
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const wasRunning = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/sync", { cache: "no-store" });
      const json = await res.json();
      if (json.ok) {
        setStatus(json.data);
        // 同期が終わった瞬間に一覧を更新する
        if (wasRunning.current && !json.data.running) router.refresh();
        wasRunning.current = json.data.running;
      }
    } catch {
      // ネットワークが一瞬切れただけの可能性があるので黙って次回に任せる
    }
  }, [router]);

  useEffect(() => {
    void fetchStatus();
    const interval = setInterval(fetchStatus, 2500);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const start = async (full: boolean) => {
    setBusy(true);
    try {
      await fetch(`/api/sync${full ? "?full=1" : ""}`, { method: "POST" });
      await fetchStatus();
    } finally {
      setBusy(false);
    }
  };

  const running = status?.running || busy;

  return (
    <div>
      <button
        type="button"
        onClick={() => void start(false)}
        disabled={running}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition hover:bg-[var(--surface-2)] disabled:opacity-60"
      >
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
          className={running ? "animate-spin" : ""}
        >
          <path
            d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {running ? "同期中…" : "Gmail と同期"}
      </button>

      {status?.progressNote && running && (
        <p className="px-3 pb-1 text-[11px] leading-snug text-[var(--text-muted)]">
          {status.progressNote}
        </p>
      )}

      {!running && status?.lastSyncedAt && (
        <p className="px-3 pb-1 text-[11px] text-[var(--text-muted)]">
          最終同期: {formatRelative(status.lastSyncedAt)}
        </p>
      )}

      {!running && !status?.initialDone && (
        <p className="px-3 pb-1 text-[11px] leading-snug text-brand-600">
          まだ読み込んでいません。「Gmail と同期」を押してください。
        </p>
      )}

      {status?.lastError && !running && (
        <p
          className="px-3 pb-1 text-[11px] leading-snug text-red-600 dark:text-red-400"
          title={status.lastError}
        >
          同期エラー: {status.lastError.slice(0, 90)}
        </p>
      )}
    </div>
  );
}
