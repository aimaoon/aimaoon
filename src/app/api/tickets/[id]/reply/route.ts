import { NextRequest } from "next/server";
import { ApiError, handle, parseTicketId, requireSession, requireString } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sendReply } from "@/lib/send";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const ticketId = parseTicketId((await params).id);

    const body = (await request.json()) as Record<string, unknown>;
    const text = requireString(body.body, "本文", { maxLength: 50000 });

    // 送信者を必ず記録する。未指定ならログイン本人
    let authorAgentId: string;
    if (typeof body.authorAgentId === "string" && body.authorAgentId) {
      authorAgentId = body.authorAgentId;
    } else {
      const me = await prisma.agentIdentity.findFirst({ where: { isMe: true } });
      if (!me) throw new ApiError("送信者となる担当者が登録されていません。", 400);
      authorAgentId = me.id;
    }

    const cc = Array.isArray(body.cc)
      ? body.cc.map((v) => String(v).trim().toLowerCase()).filter((v) => v.includes("@"))
      : [];

    const result = await sendReply({
      accountId: session.accountId,
      ticketId,
      authorAgentId,
      bodyText: text,
      includeSignature: body.includeSignature !== false,
      cc,
    });

    return result;
  });
}
