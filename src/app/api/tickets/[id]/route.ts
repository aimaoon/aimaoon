import { NextRequest } from "next/server";
import {
  ApiError,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  handle,
  parseTicketId,
  requireEnum,
  requireSession,
} from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { STATUS_LABELS, PRIORITY_LABELS } from "@/lib/format";

type Params = { params: Promise<{ id: string }> };

/** ステータス・優先度・担当者・既読状態の更新 */
export async function PATCH(request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireSession();
    const ticketId = parseTicketId((await params).id);

    const body = (await request.json()) as Record<string, unknown>;
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      include: { assignee: true },
    });
    if (!ticket) throw new ApiError("チケットが見つかりません。", 404);

    const me = await prisma.agentIdentity.findFirst({ where: { isMe: true } });
    const data: Record<string, unknown> = {};
    const logs: { type: string; detail: Record<string, unknown> }[] = [];

    if (body.status !== undefined) {
      const status = requireEnum(body.status, TICKET_STATUSES, "ステータス");
      if (status !== ticket.status) {
        data.status = status;
        logs.push({
          type: "STATUS_CHANGED",
          detail: {
            from: STATUS_LABELS[ticket.status],
            to: STATUS_LABELS[status],
          },
        });
      }
    }

    if (body.priority !== undefined) {
      const priority = requireEnum(body.priority, TICKET_PRIORITIES, "優先度");
      if (priority !== ticket.priority) {
        data.priority = priority;
        logs.push({
          type: "PRIORITY_CHANGED",
          detail: {
            from: PRIORITY_LABELS[ticket.priority],
            to: PRIORITY_LABELS[priority],
          },
        });
      }
    }

    if (body.assigneeId !== undefined) {
      const assigneeId =
        body.assigneeId === null || body.assigneeId === "" ? null : String(body.assigneeId);

      if (assigneeId) {
        const agent = await prisma.agentIdentity.findUnique({ where: { id: assigneeId } });
        if (!agent) throw new ApiError("指定された担当者が見つかりません。", 404);
      }

      if (assigneeId !== ticket.assigneeId) {
        data.assigneeId = assigneeId;
        const next = assigneeId
          ? (await prisma.agentIdentity.findUnique({ where: { id: assigneeId } }))?.name
          : null;
        logs.push({
          type: "ASSIGNED",
          detail: { from: ticket.assignee?.name ?? "未割り当て", to: next ?? "未割り当て" },
        });
      }
    }

    if (body.unread !== undefined) {
      data.unread = Boolean(body.unread);
    }

    if (body.tags !== undefined) {
      if (!Array.isArray(body.tags)) throw new ApiError("タグは配列で指定してください。");
      const tags = body.tags
        .map((t) => String(t).trim())
        .filter(Boolean)
        .slice(0, 20);
      data.tagsJson = JSON.stringify(tags);
      logs.push({ type: "TAGS_CHANGED", detail: { tags } });
    }

    if (Object.keys(data).length === 0) {
      return { updated: false };
    }

    const updated = await prisma.ticket.update({ where: { id: ticketId }, data });

    for (const log of logs) {
      await prisma.activityLog.create({
        data: {
          ticketId,
          type: log.type,
          actorId: me?.id ?? null,
          actorLabel: me ? null : "不明",
          detailJson: JSON.stringify(log.detail),
        },
      });
    }

    return { updated: true, ticket: { id: updated.id, status: updated.status } };
  });
}
