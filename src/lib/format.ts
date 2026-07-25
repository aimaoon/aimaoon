export const STATUS_LABELS: Record<string, string> = {
  OPEN: "対応中",
  PENDING: "保留",
  SOLVED: "解決済み",
  CLOSED: "クローズ",
};

export const STATUS_COLORS: Record<string, string> = {
  OPEN: "#c2410c",
  PENDING: "#a16207",
  SOLVED: "#15803d",
  CLOSED: "#64748b",
};

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "低",
  NORMAL: "通常",
  HIGH: "高",
  URGENT: "緊急",
};

export const ACTIVITY_LABELS: Record<string, string> = {
  TICKET_CREATED: "チケット作成",
  MESSAGE_RECEIVED: "顧客からのメール受信",
  MESSAGE_SENT: "返信を送信",
  STATUS_CHANGED: "ステータス変更",
  ASSIGNED: "担当者を変更",
  PRIORITY_CHANGED: "優先度を変更",
  NOTE_ADDED: "社内メモを追加",
  AUTHOR_SET: "送信者を手動設定",
  TAGS_CHANGED: "タグを変更",
};

const jstFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function formatDateTime(date: Date | string): string {
  return jstFormatter.format(new Date(date));
}

/** 一覧向けの短い表記。今日なら時刻、今年なら月日、それ以外は年月日 */
export function formatCompact(date: Date | string): string {
  const d = new Date(date);
  const now = new Date();

  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) {
    return new Intl.DateTimeFormat("ja-JP", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  }

  if (d.getFullYear() === now.getFullYear()) {
    return new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric" }).format(d);
  }

  return new Intl.DateTimeFormat("ja-JP", {
    year: "2-digit",
    month: "numeric",
    day: "numeric",
  }).format(d);
}

export function formatRelative(date: Date | string): string {
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.round(diffMs / 60000);

  if (minutes < 1) return "たった今";
  if (minutes < 60) return `${minutes}分前`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}時間前`;

  const days = Math.round(hours / 24);
  if (days < 31) return `${days}日前`;

  const months = Math.round(days / 30);
  if (months < 12) return `${months}か月前`;

  return `${Math.round(months / 12)}年前`;
}

export function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  // 日本語なら先頭 1 文字、英字なら頭文字 2 つ
  if (/[^\x00-\x7f]/.test(trimmed)) return trimmed.slice(0, 1);
  const parts = trimmed.split(/[\s.@_-]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
