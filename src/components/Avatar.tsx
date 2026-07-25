import { initialsOf } from "@/lib/format";

export function Avatar({
  name,
  color,
  size = 28,
  dimmed = false,
  title,
}: {
  name: string;
  color?: string | null;
  size?: number;
  /** 送信者不明のときに点線枠で表す */
  dimmed?: boolean;
  title?: string;
}) {
  return (
    <span
      title={title ?? name}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(10, Math.round(size * 0.4)),
        background: dimmed ? "transparent" : color || "#667085",
        color: dimmed ? "var(--text-muted)" : "#fff",
        border: dimmed ? "1.5px dashed var(--color-ink-300)" : "none",
      }}
      className="inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none"
      aria-hidden
    >
      {dimmed ? "?" : initialsOf(name)}
    </span>
  );
}
