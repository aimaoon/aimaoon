import { NextRequest } from "next/server";
import { ApiError, handle, parseTicketId, requireSession, requireString } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireSession();
    const ticketId = parseTicketId((await params).id);

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw new ApiError("チケットが見つかりません。", 404);

    const body = (await request.json()) as Record<string, unknown>;
    const text = requireString(body.body, "メモ", { maxLength: 10000 });

    const authorId =
      typeof body.authorId === "string" && body.authorId
        ? body.authorId
        : (await prisma.agentIdentity.findFirst({ where: { isMe: true } }))?.id ?? null;

    const note = await prisma.note.create({
      data: { ticketId, authorId, body: text },
      include: { author: true },
    });

    await prisma.activityLog.create({
      data: {
        ticketId,
        type: "NOTE_ADDED",
        actorId: authorId,
        detailJson: JSON.stringify({ preview: text.slice(0, 80) }),
      },
    });

    return {
      id: note.id,
      body: note.body,
      createdAt: note.createdAt.toISOString(),
      author: note.author ? { name: note.author.name, color: note.author.color } : null,
    };
  });
}
