import { google } from "googleapis";
import type { OAuth2Client } from "google-auth-library";
import { env } from "./env";
import { prisma } from "./prisma";

/**
 * 必要な権限（スコープ）
 *  - gmail.modify         : メールの読み取り・ラベル変更・送信
 *  - gmail.settings.basic : 送信元エイリアスの取得（自社宛/自社発を正しく判定するため）
 *  - openid/email/profile : ログインしたユーザーの識別
 */
export const GMAIL_SCOPES = [
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
];

export function createOAuthClient(): OAuth2Client {
  return new google.auth.OAuth2(
    env.googleClientId,
    env.googleClientSecret,
    env.redirectUri
  );
}

export function buildAuthUrl(state: string): string {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    // 毎回同意画面を出すことで refresh_token を確実に受け取る
    prompt: "consent",
    scope: GMAIL_SCOPES,
    include_granted_scopes: true,
    state,
  });
}

/**
 * 保存済みトークンで認証済みクライアントを作る。
 * アクセストークンが切れていれば google-auth-library が自動更新するので、
 * 更新されたトークンを DB に書き戻す。
 */
export async function getAuthorizedClient(accountId: string): Promise<OAuth2Client> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("アカウントが見つかりません。ログインし直してください。");

  const client = createOAuthClient();
  client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken ?? undefined,
    expiry_date: account.expiresAt ? account.expiresAt.getTime() : undefined,
    scope: account.scope ?? undefined,
  });

  client.on("tokens", (tokens) => {
    // refresh_token は初回のみ返るので、来たときだけ上書きする
    void prisma.account
      .update({
        where: { id: accountId },
        data: {
          ...(tokens.access_token ? { accessToken: tokens.access_token } : {}),
          ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
          ...(tokens.expiry_date ? { expiresAt: new Date(tokens.expiry_date) } : {}),
        },
      })
      .catch((e) => console.error("トークンの保存に失敗しました", e));
  });

  return client;
}

export async function getGmail(accountId: string) {
  const auth = await getAuthorizedClient(accountId);
  return google.gmail({ version: "v1", auth });
}

/**
 * このアカウントが「自分側」とみなすメールアドレス一覧。
 * ログインアドレス + Gmail の送信元エイリアス（support@ などの共有アドレス）。
 * 受信/送信の向きを正しく判定するために使う。
 */
export async function getOwnAddresses(accountId: string): Promise<Set<string>> {
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  const addresses = new Set<string>();
  if (account?.email) addresses.add(account.email.toLowerCase());

  try {
    const gmail = await getGmail(accountId);
    const res = await gmail.users.settings.sendAs.list({ userId: "me" });
    for (const alias of res.data.sendAs ?? []) {
      if (alias.sendAsEmail) addresses.add(alias.sendAsEmail.toLowerCase());
    }
  } catch (e) {
    // settings.basic が拒否されていても致命的ではないので続行する
    console.warn("送信元エイリアスの取得をスキップしました:", (e as Error).message);
  }

  return addresses;
}
