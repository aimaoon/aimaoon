import { prisma } from "./prisma";

/**
 * チケットの集計値（最終更新日時・未返信・複数担当など）を再計算する。
 *
 * Gmail 同期・返信送信・デモデータ生成のいずれからも呼ばれる。
 * ここを唯一の計算元にしておかないと、たとえば「最後のメールは自社からの
 * 返信なのに未返信フラグが立っている」といった食い違いが起きる。
 */
export async function recomputeTicket(threadId: string): Promise<void> {
  const ticket = await prisma.ticket.findUnique({
    where: { gmailThreadId: threadId },
    select: { id: true },
  });
  if (!ticket) return;

  const messages = await prisma.message.findMany({
    where: { ticketId: ticket.id },
    select: {
      direction: true,
      sentAt: true,
      authorAgentId: true,
      attributionMethod: true,
    },
    orderBy: { sentAt: "asc" },
  });

  if (messages.length === 0) return;

  const inbound = messages.filter((m) => m.direction === "INBOUND");
  const outbound = messages.filter((m) => m.direction === "OUTBOUND");

  const lastInboundAt = inbound.at(-1)?.sentAt ?? null;
  const lastOutboundAt = outbound.at(-1)?.sentAt ?? null;

  // 会話に関わった社内メンバーの数（不明も 1 種類として数える）
  const authorKeys = new Set(
    outbound.map((m) => m.authorAgentId ?? `unknown:${m.attributionMethod}`)
  );

  await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      messageCount: messages.length,
      firstMessageAt: messages[0].sentAt,
      lastMessageAt: messages.at(-1)!.sentAt,
      lastInboundAt,
      lastOutboundAt,
      // 顧客の最後のメールに、まだこちらが返せていない
      awaitingReply:
        lastInboundAt !== null &&
        (lastOutboundAt === null || lastInboundAt > lastOutboundAt),
      multiAgent: authorKeys.size > 1,
    },
  });
}

/** 全チケットの集計値を再計算する（ルール変更後などに使う） */
export async function recomputeAllTickets(): Promise<number> {
  const tickets = await prisma.ticket.findMany({ select: { gmailThreadId: true } });
  for (const t of tickets) {
    await recomputeTicket(t.gmailThreadId);
  }
  return tickets.length;
}
