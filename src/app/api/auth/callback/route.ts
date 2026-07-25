import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { createOAuthClient } from "@/lib/google";
import { consumeOAuthState, createSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

function fail(message: string) {
  return NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(message)}`, env.appUrl)
  );
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;

  const oauthError = params.get("error");
  if (oauthError) {
    return fail(
      oauthError === "access_denied"
        ? "Google の許可画面でキャンセルされました。"
        : `Google からエラーが返りました: ${oauthError}`
    );
  }

  const code = params.get("code");
  const state = params.get("state");
  const expectedState = await consumeOAuthState();

  if (!code) return fail("認証コードが受け取れませんでした。");
  if (!state || !expectedState || state !== expectedState) {
    return fail("認証の照合に失敗しました（state 不一致）。もう一度お試しください。");
  }

  try {
    const client = createOAuthClient();
    const { tokens } = await client.getToken(code);

    if (!tokens.access_token) return fail("アクセストークンを取得できませんでした。");
    client.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth: client });
    const { data: profile } = await oauth2.userinfo.get();

    if (!profile.id || !profile.email) {
      return fail("Google アカウントの情報を取得できませんでした。");
    }

    const existing = await prisma.account.findUnique({
      where: { googleId: profile.id },
    });

    // 2回目以降のログインでは refresh_token が返らないことがあるため、既存の値を残す
    const refreshToken = tokens.refresh_token ?? existing?.refreshToken ?? null;

    if (!refreshToken) {
      return fail(
        "リフレッシュトークンを取得できませんでした。Google アカウントの「サードパーティ製アプリ」からこのアプリのアクセスを削除してから、もう一度ログインしてください。"
      );
    }

    const account = await prisma.account.upsert({
      where: { googleId: profile.id },
      create: {
        googleId: profile.id,
        email: profile.email,
        name: profile.name ?? null,
        picture: profile.picture ?? null,
        accessToken: tokens.access_token,
        refreshToken,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope ?? null,
        syncState: { create: {} },
      },
      update: {
        email: profile.email,
        name: profile.name ?? null,
        picture: profile.picture ?? null,
        accessToken: tokens.access_token,
        refreshToken,
        expiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scope: tokens.scope ?? null,
      },
    });

    await prisma.syncState.upsert({
      where: { accountId: account.id },
      create: { accountId: account.id },
      update: {},
    });

    // ログイン本人を担当者として登録しておく（返信の記録に使う）
    const me = await prisma.agentIdentity.findFirst({ where: { isMe: true } });
    if (!me) {
      await prisma.agentIdentity.create({
        data: {
          name: profile.name || profile.email,
          email: profile.email,
          isMe: true,
          color: "#2a56c4",
        },
      });
    }

    await createSession({ accountId: account.id, email: account.email });

    return NextResponse.redirect(new URL("/tickets", env.appUrl));
  } catch (e) {
    console.error("OAuth コールバックでエラー", e);
    return fail(`ログインに失敗しました: ${(e as Error).message}`);
  }
}
