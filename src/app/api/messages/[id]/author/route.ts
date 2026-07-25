import { NextRequest } from "next/server";
import { ApiError, handle, requireSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import {
  ATTRIBUTION_METHODS,
  RULE_KINDS,
  learnFromManualAssignment,
  reattributeAll,
} from "@/lib/attribution";
import { getOwnAddresses } from "@/lib/google";
import { recomputeTicket } from "@/lib/sync";

type Params = { params: Promise<{ id: string }> };

/**
 * 「このメールを送ったのは誰か」を手動で設定する。
 * 同時に判別ルールを学習し、同じパターンの過去メールもまとめて更新する。
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const messageId = (await params).id;

    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: { ticket: true },
    });
    if (!message) throw new ApiError("メールが見つかりません。", 404);
    if (message.direction !== "OUTBOUND") {
      throw new ApiError("送信者を設定できるのは送信メールだけです。");
    }

    const body = (await request.json()) as Record<string, unknown>;
    const agentId =
      body.agentId === null || body.agentId === "" ? null : String(body.agentId);

    if (agentId) {
      const agent = await prisma.agentIdentity.findUnique({ where: { id: agentId } });
      if (!agent) throw new ApiError("指定された担当者が見つかりません。", 404);
    }

    await prisma.message.update({
      where: { id: messageId },
      data: {
        authorAgentId: agentId,
        attributionMethod: agentId
          ? ATTRIBUTION_METHODS.MANUAL
          : ATTRIBUTION_METHODS.UNKNOWN,
        attributionLocked: agentId !== null,
      },
    });

    const learned: string[] = [];

    if (agentId) {
      // 委任送信のアドレスがあれば、それをルール化する
      const delegateNote = await learnFromManualAssignment(agentId, {
        senderEmail: message.senderEmail,
        fromName: message.fromName,
        fromEmail: message.fromEmail,
      });
      if (delegateNote) learned.push(delegateNote);

      // 画面で選ばれた署名キーワードをルール化する
      const signature =
        typeof body.learnSignature === "string" ? body.learnSignature.trim() : "";
      if (signature.length >= 2 && signature.length <= 60) {
        await prisma.attributionRule.upsert({
          where: {
            kind_pattern: {
              kind: RULE_KINDS.SIGNATURE_CONTAINS,
              pattern: signature.toLowerCase(),
            },
          },
          create: {
            agentId,
            kind: RULE_KINDS.SIGNATURE_CONTAINS,
            pattern: signature.toLowerCase(),
            source: "LEARNED",
            priority: 30,
          },
          update: { agentId },
        });
        learned.push(`今後、本文に「${signature}」を含む返信は自動でこの担当者になります`);
      }
    }

    await prisma.activityLog.create({
      data: {
        ticketId: message.ticketId,
        type: "AUTHOR_SET",
        actorId: agentId,
        detailJson: JSON.stringify({
          gmailMessageId: message.gmailMessageId,
          sentAt: message.sentAt.toISOString(),
          learned,
        }),
      },
    });

    // ルールを学習した場合は、過去のメールにも遡って適用する
    let reattributed = 0;
    if (learned.length > 0) {
      const ownAddresses = await getOwnAddresses(session.accountId);
      reattributed = await reattributeAll(ownAddresses);
    }

    await recomputeTicket(message.gmailThreadId);

    return { learned, reattributed };
  });
}
