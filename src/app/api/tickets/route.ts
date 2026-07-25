import { NextRequest } from "next/server";
import type { Prisma } from "@prisma/client";
import { handle, requireSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export type TicketListItem = {
  id: number;
  subject: string;
  status: string;
  priority: string;
  contactName: string;
  contactEmail: string;
  assignee: { id: string; name: string; color: string } | null;
  lastMessageAt: string;
  messageCount: number;
  unread: boolean;
  awaitingReply: boolean;
  multiAgent: boolean;
  snippet: string | null;
  /** この会話で返信した社内メンバー（不明分を含む） */
  responders: { id: string | null; name: string; color: string }[];
};

export async function GET(request: NextRequest) {
  return handle(async () => {
    await requireSession();

    const params = request.nextUrl.searchParams;
    const status = params.get("status") ?? "OPEN";
    const assignee = params.get("assignee") ?? "";
    const view = params.get("view") ?? "";
    const q = (params.get("q") ?? "").trim();
    const page = Math.max(1, Number(params.get("page") ?? 1) || 1);

    const where: Prisma.TicketWhereInput = {};

    if (status && status !== "ALL") {
      where.status = status;
    }
    if (assignee === "unassigned") {
      where.assigneeId = null;
    } else if (assignee) {
      where.assigneeId = assignee;
    }
    if (view === "awaiting") where.awaitingReply = true;
    if (view === "multiAgent") where.multiAgent = true;
    if (view === "unknownSender") {
      where.messages = {
        some: { direction: "OUTBOUND", authorAgentId: null },
      };
    }

    if (q) {
      where.OR = [
        { subject: { contains: q } },
        { contact: { email: { contains: q } } },
        { contact: { name: { contains: q } } },
        { messages: { some: { bodyText: { contains: q } } } },
      ];
    }

    const [tickets, total] = await Promise.all([
      prisma.ticket.findMany({
        where,
        include: {
          contact: true,
          assignee: { select: { id: true, name: true, color: true } },
          messages: {
            orderBy: { sentAt: "desc" },
            take: 1,
            select: { snippet: true, bodyText: true },
          },
        },
        orderBy: { lastMessageAt: "desc" },
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      prisma.ticket.count({ where }),
    ]);

    const ticketIds = tickets.map((t) => t.id);

    // 各チケットで返信した社内メンバーを 1 クエリでまとめて取得する
    const grouped =
      ticketIds.length > 0
        ? await prisma.message.groupBy({
            by: ["ticketId", "authorAgentId"],
            where: { ticketId: { in: ticketIds }, direction: "OUTBOUND" },
          })
        : [];

    const agentIds = [
      ...new Set(grouped.map((g) => g.authorAgentId).filter((v): v is string => !!v)),
    ];
    const agents = await prisma.agentIdentity.findMany({
      where: { id: { in: agentIds } },
      select: { id: true, name: true, color: true },
    });
    const agentMap = new Map(agents.map((a) => [a.id, a]));

    const respondersByTicket = new Map<number, TicketListItem["responders"]>();
    for (const row of grouped) {
      const list = respondersByTicket.get(row.ticketId) ?? [];
      if (row.authorAgentId) {
        const agent = agentMap.get(row.authorAgentId);
        if (agent) list.push({ id: agent.id, name: agent.name, color: agent.color });
      } else {
        list.push({ id: null, name: "送信者不明", color: "#8892a3" });
      }
      respondersByTicket.set(row.ticketId, list);
    }

    const items: TicketListItem[] = tickets.map((t) => ({
      id: t.id,
      subject: t.subject,
      status: t.status,
      priority: t.priority,
      contactName: t.contact.name || t.contact.email,
      contactEmail: t.contact.email,
      assignee: t.assignee,
      lastMessageAt: t.lastMessageAt.toISOString(),
      messageCount: t.messageCount,
      unread: t.unread,
      awaitingReply: t.awaitingReply,
      multiAgent: t.multiAgent,
      snippet: t.messages[0]?.snippet ?? t.messages[0]?.bodyText?.slice(0, 160) ?? null,
      responders: respondersByTicket.get(t.id) ?? [],
    }));

    return { items, total, page, pageSize: PAGE_SIZE };
  });
}
