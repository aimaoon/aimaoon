import { prisma } from "./prisma";

/**
 * 顧客 1 人との全やり取りを、案件（チケット）をまたいで時系列に並べる。
 *
 * Gmail のスレッド = チケットなので、同じ相手でも別件は別チケットになる。
 * 「自分が送った件」と「休みの日に同僚が別件で返した件」が別々の場所に
 * 散らばると経緯が追えないため、ここで 1 本の時間軸にまとめる。
 */

/** 1 顧客あたりで読み込む最大件数（極端に多い相手でも画面が壊れないように） */
export const TIMELINE_LIMIT = 300;

export type TimelineEntry = {
  kind: "message" | "note";
  id: string;
  at: Date;
  /** どの案件のものか */
  ticketId: number;
  ticketSubject: string;
  /** INBOUND | OUTBOUND（メモは null） */
  direction: string | null;
  /** 表示名（顧客名 or 社内担当者名 or 送信者不明） */
  personName: string;
  personColor: string | null;
  /** 社内側で送信者を特定できなかった */
  unknownSender: boolean;
  attributionMethod: string | null;
  bodyHtml: string | null;
  quotedHtml: string | null;
  bodyText: string | null;
  hasAttachments: boolean;
};

export type ContactSummary = {
  /** この顧客に返信した社内メンバーの内訳 */
  responders: { name: string; color: string; count: number; unknown: boolean }[];
  ticketCount: number;
  messageCount: number;
  inboundCount: number;
  outboundCount: number;
  openCount: number;
  awaitingCount: number;
  firstAt: Date | null;
  lastAt: Date | null;
  /** 上限に達して打ち切ったか */
  truncated: boolean;
};

export async function loadContactTimeline(contactId: string): Promise<{
  entries: TimelineEntry[];
  summary: ContactSummary;
} | null> {
  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { id: true },
  });
  if (!contact) return null;

  const tickets = await prisma.ticket.findMany({
    where: { contactId },
    select: { id: true, subject: true, status: true, awaitingReply: true },
  });

  const ticketIds = tickets.map((t) => t.id);
  const subjectOf = new Map(tickets.map((t) => [t.id, t.subject]));

  if (ticketIds.length === 0) {
    return {
      entries: [],
      summary: {
        responders: [],
        ticketCount: 0,
        messageCount: 0,
        inboundCount: 0,
        outboundCount: 0,
        openCount: 0,
        awaitingCount: 0,
        firstAt: null,
        lastAt: null,
        truncated: false,
      },
    };
  }

  // 新しい順に上限まで取り、あとで古い順に並べ直す
  const [messages, notes, totalMessages] = await Promise.all([
    prisma.message.findMany({
      where: { ticketId: { in: ticketIds } },
      include: { authorAgent: { select: { name: true, color: true } } },
      orderBy: { sentAt: "desc" },
      take: TIMELINE_LIMIT,
    }),
    prisma.note.findMany({
      where: { ticketId: { in: ticketIds } },
      include: { author: { select: { name: true, color: true } } },
      orderBy: { createdAt: "desc" },
      take: TIMELINE_LIMIT,
    }),
    prisma.message.count({ where: { ticketId: { in: ticketIds } } }),
  ]);

  const entries: TimelineEntry[] = [
    ...messages.map((m): TimelineEntry => {
      const inbound = m.direction === "INBOUND";
      const unknownSender = !inbound && !m.authorAgent;
      return {
        kind: "message",
        id: m.id,
        at: m.sentAt,
        ticketId: m.ticketId,
        ticketSubject: subjectOf.get(m.ticketId) ?? "(件名なし)",
        direction: m.direction,
        personName: inbound
          ? m.fromName || m.fromEmail
          : (m.authorAgent?.name ?? "送信者不明"),
        personColor: inbound ? "#667085" : (m.authorAgent?.color ?? null),
        unknownSender,
        attributionMethod: inbound ? null : m.attributionMethod,
        bodyHtml: m.bodyHtml,
        quotedHtml: m.quotedHtml,
        bodyText: m.bodyText,
        hasAttachments: m.hasAttachments,
      };
    }),
    ...notes.map((n): TimelineEntry => ({
      kind: "note",
      id: n.id,
      at: n.createdAt,
      ticketId: n.ticketId,
      ticketSubject: subjectOf.get(n.ticketId) ?? "(件名なし)",
      direction: null,
      personName: n.author?.name ?? "不明",
      personColor: n.author?.color ?? null,
      unknownSender: !n.author,
      attributionMethod: null,
      bodyHtml: null,
      quotedHtml: null,
      bodyText: n.body,
      hasAttachments: false,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  // 返信した社内メンバーの内訳（読み込んだ範囲ではなく全件で数える）
  const grouped = await prisma.message.groupBy({
    by: ["authorAgentId"],
    where: { ticketId: { in: ticketIds }, direction: "OUTBOUND" },
    _count: { _all: true },
  });

  const agentIds = grouped
    .map((g) => g.authorAgentId)
    .filter((v): v is string => v !== null);
  const agents = await prisma.agentIdentity.findMany({
    where: { id: { in: agentIds } },
    select: { id: true, name: true, color: true },
  });
  const agentMap = new Map(agents.map((a) => [a.id, a]));

  const responders = grouped
    .map((g) => {
      const agent = g.authorAgentId ? agentMap.get(g.authorAgentId) : null;
      return {
        name: agent?.name ?? "送信者不明",
        color: agent?.color ?? "#8892a3",
        count: g._count._all,
        unknown: !agent,
      };
    })
    .sort((a, b) => b.count - a.count);

  const inboundCount = await prisma.message.count({
    where: { ticketId: { in: ticketIds }, direction: "INBOUND" },
  });

  const bounds = await prisma.message.aggregate({
    where: { ticketId: { in: ticketIds } },
    _min: { sentAt: true },
    _max: { sentAt: true },
  });

  return {
    entries,
    summary: {
      responders,
      ticketCount: tickets.length,
      messageCount: totalMessages,
      inboundCount,
      outboundCount: totalMessages - inboundCount,
      openCount: tickets.filter((t) => t.status === "OPEN" || t.status === "PENDING")
        .length,
      awaitingCount: tickets.filter((t) => t.awaitingReply).length,
      firstAt: bounds._min.sentAt,
      lastAt: bounds._max.sentAt,
      truncated: totalMessages > TIMELINE_LIMIT,
    },
  };
}

/** 顧客一覧（検索つき） */
export async function listContacts(query: string) {
  const q = query.trim();

  const contacts = await prisma.contact.findMany({
    where: q
      ? { OR: [{ email: { contains: q } }, { name: { contains: q } }, { company: { contains: q } }] }
      : undefined,
    include: {
      tickets: {
        select: { id: true, lastMessageAt: true, awaitingReply: true, status: true },
      },
    },
    take: 200,
  });

  const ticketIds = contacts.flatMap((c) => c.tickets.map((t) => t.id));

  // どの顧客に誰が返信したかを 1 クエリでまとめて取る
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
  const respondersByTicket = new Map<number, Set<string>>();
  for (const row of grouped) {
    const set = respondersByTicket.get(row.ticketId) ?? new Set<string>();
    set.add(row.authorAgentId ?? "__unknown__");
    respondersByTicket.set(row.ticketId, set);
  }

  return contacts
    .map((c) => {
      const keys = new Set<string>();
      for (const t of c.tickets) {
        for (const key of respondersByTicket.get(t.id) ?? []) keys.add(key);
      }

      const responders = [...keys].map((key) => {
        const agent = agentMap.get(key);
        return {
          name: agent?.name ?? "送信者不明",
          color: agent?.color ?? "#8892a3",
          unknown: !agent,
        };
      });

      const lastAt = c.tickets.reduce<Date | null>(
        (acc, t) => (!acc || t.lastMessageAt > acc ? t.lastMessageAt : acc),
        null
      );

      return {
        id: c.id,
        email: c.email,
        name: c.name,
        company: c.company,
        ticketCount: c.tickets.length,
        awaitingCount: c.tickets.filter((t) => t.awaitingReply).length,
        openCount: c.tickets.filter((t) => t.status === "OPEN" || t.status === "PENDING")
          .length,
        lastAt,
        responders,
        /** 複数の社内メンバーが関わっている */
        multiAgent: keys.size > 1,
      };
    })
    .sort((a, b) => (b.lastAt?.getTime() ?? 0) - (a.lastAt?.getTime() ?? 0));
}
