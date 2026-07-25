import { prisma } from "./prisma";

/**
 * デモモード。
 *
 * Google Cloud の設定を済ませる前に画面を触れるようにするための仕組みです。
 * .env に DEMO_MODE=1 があるときだけ有効になり、Gmail には一切接続しません。
 * 本番の設定（GOOGLE_CLIENT_ID など）とは独立しています。
 */

export const DEMO_GOOGLE_ID = "demo-account-no-gmail";
export const DEMO_EMAIL = "support@example.com";

export function isDemoModeEnabled(): boolean {
  return process.env.DEMO_MODE === "1";
}

/** このアカウントが Gmail に繋がっていないデモ用かどうか */
export async function isDemoAccount(accountId: string): Promise<boolean> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    select: { googleId: true },
  });
  return account?.googleId === DEMO_GOOGLE_ID;
}

/** デモ用アカウントを用意する（既にあれば使い回す） */
export async function ensureDemoAccount() {
  const existing = await prisma.account.findUnique({
    where: { googleId: DEMO_GOOGLE_ID },
  });
  if (existing) return existing;

  // 同じアドレスで実アカウントが既にログイン済みなら、そちらを壊さないよう別名にする
  const emailTaken = await prisma.account.findUnique({ where: { email: DEMO_EMAIL } });
  const email = emailTaken ? `demo+${Date.now()}@example.com` : DEMO_EMAIL;

  return prisma.account.create({
    data: {
      googleId: DEMO_GOOGLE_ID,
      email,
      name: "デモ（サポート窓口）",
      accessToken: "demo-no-gmail-access",
      refreshToken: null,
      syncState: {
        create: {
          initialDone: true,
          lastSyncedAt: new Date(),
          progressNote: "デモデータ（Gmail とは未接続）",
        },
      },
    },
  });
}
