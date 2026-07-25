/**
 * テスト用のログインセッションを発行するヘルパー。
 * Google にアクセスせずに API を叩けるよう、ダミーのアカウントを 1 件用意して
 * 本番と同じ方式（SESSION_SECRET で署名した JWT）の Cookie を作ります。
 */
import { PrismaClient } from "@prisma/client";
import { SignJWT } from "jose";
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

function loadEnv() {
  const file = path.join(ROOT, ".env");
  if (!fs.existsSync(file)) {
    throw new Error(".env が見つかりません。.env.example をコピーして作成してください。");
  }
  return Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.trim().startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, "")];
      })
  );
}

export async function createTestSession(prisma = new PrismaClient()) {
  const env = loadEnv();
  if (!env.SESSION_SECRET) throw new Error(".env に SESSION_SECRET が必要です。");

  // email も googleId も一意なので、email 基準で探してから作る
  const account =
    (await prisma.account.findUnique({ where: { email: "support@example.com" } })) ??
    (await prisma.account.create({
      data: {
        googleId: "test-google-id",
        email: "support@example.com",
        name: "サポート窓口",
        accessToken: "test-token",
        refreshToken: "test-refresh",
        syncState: { create: { initialDone: true, lastSyncedAt: new Date() } },
      },
    }));

  await prisma.syncState.upsert({
    where: { accountId: account.id },
    create: { accountId: account.id, initialDone: true, lastSyncedAt: new Date() },
    update: {},
  });

  const token = await new SignJWT({ accountId: account.id, email: account.email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(env.SESSION_SECRET));

  return { token, account, cookie: `mt_session=${token}` };
}
