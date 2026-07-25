import { NextRequest } from "next/server";
import { ApiError, handle, requireSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { reattributeAll } from "@/lib/attribution";
import { getOwnAddresses } from "@/lib/google";
import { recomputeAllTickets } from "@/lib/sync";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    const session = await requireSession();
    const id = (await params).id;

    const rule = await prisma.attributionRule.findUnique({ where: { id } });
    if (!rule) throw new ApiError("ルールが見つかりません。", 404);

    await prisma.attributionRule.delete({ where: { id } });

    const ownAddresses = await getOwnAddresses(session.accountId);
    const reattributed = await reattributeAll(ownAddresses);
    await recomputeAllTickets();

    return { deleted: true, reattributed };
  });
}
