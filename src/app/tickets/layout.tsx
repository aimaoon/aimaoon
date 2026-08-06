import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/Sidebar";
import { TicketList } from "@/components/TicketList";
import { DemoBanner } from "@/components/DemoBanner";
import { isDemoAccount } from "@/lib/demo";
import { cutoffFor, urgencyThresholds } from "@/lib/urgency";

export const dynamic = "force-dynamic";

export default async function TicketsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const demo = await isDemoAccount(session.accountId);

  // 未返信の経過時間ごとの件数。閾値より古い「顧客からの最後のメール」を数える
  const now = new Date();
  const urgentWhere = (level: "WATCH" | "LATE" | "CRITICAL") => ({
    awaitingReply: true,
    status: { in: ["OPEN", "PENDING"] },
    lastInboundAt: { lt: cutoffFor(level, now)! },
  });

  const [
    statusGroups,
    awaiting,
    multiAgent,
    unknownSender,
    all,
    agents,
    urgentWatch,
    urgentLate,
    urgentCritical,
  ] = await Promise.all([
      prisma.ticket.groupBy({ by: ["status"], _count: { _all: true } }),
      prisma.ticket.count({ where: { awaitingReply: true } }),
      prisma.ticket.count({ where: { multiAgent: true } }),
      prisma.ticket.count({
        where: { messages: { some: { direction: "OUTBOUND", authorAgentId: null } } },
      }),
      prisma.ticket.count(),
      prisma.agentIdentity.findMany({
        where: { active: true },
        select: { id: true, name: true, color: true, isMe: true },
        orderBy: [{ isMe: "desc" }, { name: "asc" }],
      }),
      prisma.ticket.count({ where: urgentWhere("WATCH") }),
      prisma.ticket.count({ where: urgentWhere("LATE") }),
      prisma.ticket.count({ where: urgentWhere("CRITICAL") }),
    ]);

  const byStatus: Record<string, number> = {};
  for (const group of statusGroups) {
    byStatus[group.status] = group._count._all;
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {demo && <DemoBanner />}

      <div className="flex min-h-0 flex-1">
        <Suspense fallback={<div className="w-56 border-r border-[var(--border)]" />}>
          <Sidebar
            counts={{
              byStatus,
              awaiting,
              multiAgent,
              unknownSender,
              all,
              urgentWatch,
              urgentLate,
              urgentCritical,
            }}
            agents={agents}
            accountEmail={session.email}
            thresholds={urgencyThresholds()}
            demo={demo}
          />
        </Suspense>

        <Suspense
          fallback={<div className="w-[22rem] shrink-0 border-r border-[var(--border)]" />}
        >
          <TicketList />
        </Suspense>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
