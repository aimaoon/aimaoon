import { NextRequest } from "next/server";
import { ApiError, handle, requireEnum, requireSession, requireString } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { reattributeAll } from "@/lib/attribution";
import { getOwnAddresses } from "@/lib/google";
import { recomputeAllTickets } from "@/lib/sync";

export const dynamic = "force-dynamic";

const KINDS = ["DELEGATE_EMAIL", "FROM_NAME", "SIGNATURE_CONTAINS"] as const;

export async function GET() {
  return handle(async () => {
    await requireSession();
    const rules = await prisma.attributionRule.findMany({
      include: { agent: { select: { id: true, name: true, color: true } } },
      orderBy: [{ kind: "asc" }, { priority: "asc" }],
    });

    return rules.map((r) => ({
      id: r.id,
      kind: r.kind,
      pattern: r.pattern,
      source: r.source,
      agent: r.agent,
    }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();
    const body = (await request.json()) as Record<string, unknown>;

    const kind = requireEnum(body.kind, KINDS, "ルールの種類");
    const pattern = requireString(body.pattern, "照合する文字列", { maxLength: 120 })
      .toLowerCase();
    const agentId = requireString(body.agentId, "担当者");

    const agent = await prisma.agentIdentity.findUnique({ where: { id: agentId } });
    if (!agent) throw new ApiError("担当者が見つかりません。", 404);

    if (kind === "DELEGATE_EMAIL" && !pattern.includes("@")) {
      throw new ApiError("委任送信のルールにはメールアドレスを指定してください。");
    }

    await prisma.attributionRule.upsert({
      where: { kind_pattern: { kind, pattern } },
      create: {
        agentId,
        kind,
        pattern,
        source: "MANUAL",
        priority: kind === "DELEGATE_EMAIL" ? 10 : kind === "FROM_NAME" ? 20 : 30,
      },
      update: { agentId },
    });

    // 新しいルールを過去のメールにも適用する
    const ownAddresses = await getOwnAddresses(session.accountId);
    const reattributed = await reattributeAll(ownAddresses);
    await recomputeAllTickets();

    return { reattributed };
  });
}
