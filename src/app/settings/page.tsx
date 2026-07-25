import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SettingsClient } from "@/components/SettingsClient";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [agents, rules] = await Promise.all([
    prisma.agentIdentity.findMany({
      orderBy: [{ isMe: "desc" }, { name: "asc" }],
      include: { _count: { select: { authoredMessages: true } } },
    }),
    prisma.attributionRule.findMany({
      include: { agent: { select: { id: true, name: true, color: true } } },
      orderBy: [{ kind: "asc" }, { pattern: "asc" }],
    }),
  ]);

  return (
    <div className="min-h-screen">
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-6 py-3">
        <Link
          href="/tickets"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--text-muted)] transition hover:text-[var(--text)]"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="m15 18-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          チケット一覧に戻る
        </Link>
      </div>

      <SettingsClient
        agents={agents.map((a) => ({
          id: a.id,
          name: a.name,
          email: a.email,
          color: a.color,
          isMe: a.isMe,
          messageCount: a._count.authoredMessages,
        }))}
        rules={rules.map((r) => ({
          id: r.id,
          kind: r.kind,
          pattern: r.pattern,
          source: r.source,
          agent: r.agent,
        }))}
      />
    </div>
  );
}
