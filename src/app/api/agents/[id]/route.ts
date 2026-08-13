import { NextRequest } from "next/server";
import { ApiError, handle, requireSession, requireString } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { RULE_KINDS } from "@/lib/attribution";

type Params = { params: Promise<{ id: string }> };

/**
 * 氏名から、署名の照合に使える語を長い順に取り出す。
 * 「山田　太郎」なら ["山田　太郎"(全角空白のまま), "山田", "太郎"] の順に試す。
 * 短すぎる語は他人の署名に紛れ込みやすいので 2 文字以上に限る。
 */
function nameTokens(name: string): string[] {
  const full = name.trim();
  const parts = full.split(/[\s\u3000]+/).filter((p) => p.length >= 2);
  return [full, ...parts.sort((a, b) => b.length - a.length)].filter(
    (t, i, arr) => t.length >= 2 && arr.indexOf(t) === i
  );
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handle(async () => {
    await requireSession();
    const id = (await params).id;

    const agent = await prisma.agentIdentity.findUnique({ where: { id } });
    if (!agent) throw new ApiError("担当者が見つかりません。", 404);

    const body = (await request.json()) as Record<string, unknown>;
    const data: Record<string, unknown> = {};

    if (body.name !== undefined) data.name = requireString(body.name, "名前", { maxLength: 60 });

    if (body.signature !== undefined) {
      const signature =
        typeof body.signature === "string" && body.signature.trim()
          ? body.signature.replace(/\r\n/g, "\n").trimEnd()
          : null;
      if (signature && signature.length > 4000) {
        throw new ApiError("署名が長すぎます（4000 文字以内）。");
      }
      data.signature = signature;
    }
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

    // 署名に本人の氏名が入っていれば、それを判別ルールにしておく。
    // Gmail から直接返信した分も、この署名から送信者を特定できるようになる。
    const learned: string[] = [];
    if (updated.signature) {
      for (const token of nameTokens(updated.name)) {
        if (!updated.signature.includes(token)) continue;
        await prisma.attributionRule.upsert({
          where: {
            kind_pattern: {
              kind: RULE_KINDS.SIGNATURE_CONTAINS,
              pattern: token.toLowerCase(),
            },
          },
          create: {
            agentId: updated.id,
            kind: RULE_KINDS.SIGNATURE_CONTAINS,
            pattern: token.toLowerCase(),
            source: "LEARNED",
            priority: 30,
          },
          update: { agentId: updated.id },
        });
        learned.push(token);
        break; // 一番長い（＝特徴的な）ものが 1 つあれば十分
      }
    }

    return { id: updated.id, name: updated.name, learned };
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
