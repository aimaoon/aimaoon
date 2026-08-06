/**
 * 「顧客の最後のメールから何時間返信できていないか」で緊急度を自動算出する。
 *
 * 手動で設定する優先度（低/通常/高/緊急）とは別物として扱う。
 *  - 手動の優先度 … 内容を見た人の判断
 *  - 緊急度       … 放置時間から自動で決まる、時間とともに上がるもの
 * 混ぜてしまうと「自分で高くしたのか、放置して赤くなったのか」が
 * 分からなくなるため、別々に表示する。
 *
 * 判定の起点は「顧客からの最後のメール（lastInboundAt）」。
 * こちらが返信すれば awaitingReply が false になり、緊急度は消える。
 *
 * 経過時間は実時間で数える。土日も交代で対応する運用のため、週末や
 * 営業時間外を差し引くことはしない（金曜夕方の未返信は月曜朝には
 * 「重大な遅れ」になる）。この方針は tests/unit.mts で固定してある。
 */

export const URGENCY_LEVELS = ["NONE", "WATCH", "LATE", "CRITICAL"] as const;
export type UrgencyLevel = (typeof URGENCY_LEVELS)[number];

export type UrgencyInfo = {
  level: UrgencyLevel;
  /** 顧客の最後のメールからの経過時間（時間単位・未返信でなければ null） */
  hours: number | null;
  /** 「3時間」「2日」など表示用 */
  elapsed: string | null;
};

/** 段階ごとの見た目と説明。UI 側はこれを参照する */
export const URGENCY_STYLE: Record<
  UrgencyLevel,
  { label: string; short: string; fg: string; bg: string; describe: string }
> = {
  NONE: {
    label: "",
    short: "",
    fg: "",
    bg: "",
    describe: "返信済み、または顧客からの新着待ちではありません。",
  },
  WATCH: {
    label: "要対応",
    short: "要対応",
    fg: "#a16207",
    bg: "#fef9c3",
    describe: "顧客を待たせ始めています。",
  },
  LATE: {
    label: "遅延",
    short: "遅延",
    fg: "#c2410c",
    bg: "#ffedd5",
    describe: "返信の目安時間を超えています。",
  },
  CRITICAL: {
    label: "重大な遅れ",
    short: "重大",
    fg: "#b91c1c",
    bg: "#fee2e2",
    describe: "長時間放置されています。最優先で対応してください。",
  },
};

/** 閾値（時間）。.env で運用に合わせて変えられる */
export function urgencyThresholds() {
  const read = (key: string, fallback: number) => {
    const n = Number(process.env[key]);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  const watch = read("URGENCY_WATCH_HOURS", 4);
  const late = read("URGENCY_LATE_HOURS", 24);
  const critical = read("URGENCY_CRITICAL_HOURS", 48);

  // 逆転していると判定が壊れるので、必ず昇順になるよう補正する
  return {
    watch,
    late: Math.max(late, watch),
    critical: Math.max(critical, late, watch),
  };
}

export function formatElapsed(hours: number): string {
  if (hours < 1) {
    const minutes = Math.max(1, Math.round(hours * 60));
    return `${minutes}分`;
  }
  if (hours < 24) return `${Math.floor(hours)}時間`;

  const days = Math.floor(hours / 24);
  const rest = Math.floor(hours % 24);
  return rest > 0 && days < 3 ? `${days}日${rest}時間` : `${days}日`;
}

/**
 * チケット 1 件の緊急度を求める。
 * 解決済み・クローズや、返信済みのものは NONE。
 */
export function urgencyOf(
  ticket: {
    status: string;
    awaitingReply: boolean;
    lastInboundAt: Date | string | null;
  },
  now: Date = new Date()
): UrgencyInfo {
  if (!ticket.awaitingReply || !ticket.lastInboundAt) {
    return { level: "NONE", hours: null, elapsed: null };
  }
  if (ticket.status === "SOLVED" || ticket.status === "CLOSED") {
    return { level: "NONE", hours: null, elapsed: null };
  }

  const since = new Date(ticket.lastInboundAt).getTime();
  const hours = (now.getTime() - since) / 3_600_000;
  if (!Number.isFinite(hours) || hours < 0) {
    return { level: "NONE", hours: null, elapsed: null };
  }

  const t = urgencyThresholds();
  const level: UrgencyLevel =
    hours >= t.critical ? "CRITICAL" : hours >= t.late ? "LATE" : hours >= t.watch ? "WATCH" : "NONE";

  return { level, hours, elapsed: formatElapsed(hours) };
}

/**
 * 指定した段階以上のチケットを絞り込むための「この時刻より前」を返す。
 * 例: LATE なら「24時間前より古い lastInboundAt」を探せばよい。
 */
export function cutoffFor(level: UrgencyLevel, now: Date = new Date()): Date | null {
  const t = urgencyThresholds();
  const hours =
    level === "WATCH" ? t.watch : level === "LATE" ? t.late : level === "CRITICAL" ? t.critical : null;
  if (hours === null) return null;
  return new Date(now.getTime() - hours * 3_600_000);
}
