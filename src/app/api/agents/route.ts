import { NextRequest } from "next/server";
import { ApiError, handle, requireSession, requireString } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { colorForString } from "@/lib/attribution";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireSession();
    const agents = await prisma.agentIdentity.findMany({
      orderBy: [{ isMe: "desc" }, { name: "asc" }],
      include: {
        _count: { select: { authoredMessages: true, rules: true } },
      },
    });

    return agents.map((a) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      color: a.color,
      isMe: a.isMe,
      active: a.active,
      messageCount: a._count.authoredMessages,
      ruleCount: a._count.rules,
    }));
  });
}

export async function POST(request: NextRequest) {
  return handle(async () => {
    await requireSession();
    const body = (await request.json()) as Record<string, unknown>;

    const name = requireString(body.name, "名前", { maxLength: 60 });
    const email =
      typeof body.email === "string" && body.email.trim()
        ? body.email.trim().toLowerCase()
        : null;

    if (email && !email.includes("@")) {
      throw new ApiError("メールアドレスの形式が正しくありません。");
    }
    if (email) {
      const existing = await prisma.agentIdentity.findUnique({ where: { email } });
      if (existing) throw new ApiError("そのメールアドレスの担当者はすでに登録されています。");
    }

    const agent = await prisma.agentIdentity.create({
      data: {
        name,
        email,
        color: typeof body.color === "string" ? body.color : colorForString(name),
      },
    });

    // 個人アドレスが分かっているなら、委任送信の判別ルールも同時に作る
    if (email) {
      await prisma.attributionRule.upsert({
        where: { kind_pattern: { kind: "DELEGATE_EMAIL", pattern: email } },
        create: {
          agentId: agent.id,
          kind: "DELEGATE_EMAIL",
          pattern: email,
          source: "MANUAL",
          priority: 10,
        },
        update: { agentId: agent.id },
      });
    }

    return { id: agent.id, name: agent.name, color: agent.color };
  });
}
