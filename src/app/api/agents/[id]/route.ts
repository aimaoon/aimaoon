import { NextRequest } from "next/server";
import { ApiError, handle, requireSession, requireString } from "@/lib/api";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireSession();
    const id = (await params).id;

    const agent = await prisma.agentIdentity.findUnique({ where: { id } });
    if (!agent) throw new ApiError("担当者が見つかりません。", 404);

    const body = (await request.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = requireString(body.name, "名前", { maxLength: 60 });
    if (body.color !== undefined && typeof body.color === "string") data.color = body.color;
    if (body.active !== undefined) data.active = Boolean(body.active);

    if (body.email !== undefined) {
      const email =
        typeof body.email === "string" && body.email.trim()
          ? body.email.trim().toLowerCase()
          : null;
      if (email && !email.includes("@")) {
        throw new ApiError("メールアドレスの形式が正しくありません。");
      }
      if (email && email !== agent.email) {
        const clash = await prisma.agentIdentity.findUnique({ where: { email } });
        if (clash) throw new ApiError("そのメールアドレスは別の担当者が使用しています。");
      }
      data.email = email;
    }

    const updated = await prisma.agentIdentity.update({ where: { id }, data });
    return { id: updated.id, name: updated.name };
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireSession();
    const id = (await params).id;

    const agent = await prisma.agentIdentity.findUnique({ where: { id } });
    if (!agent) throw new ApiError("担当者が見つかりません。", 404);
    if (agent.isMe) throw new ApiError("ログイン中の本人は削除できません。");

    // メールの履歴は消さず、担当者との紐付けだけ外す
    await prisma.agentIdentity.delete({ where: { id } });
    return { deleted: true };
  });
}
