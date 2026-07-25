/**
 * デモを動かすための下ごしらえを一度にやります。
 *
 *   npm run demo
 *
 * やること:
 *   1. .env が無ければ作り、SESSION_SECRET を自動生成する
 *   2. DEMO_MODE=1 を有効にする
 *   3. Prisma クライアントの生成とデータベースの作成
 *
 * 既存の .env の GOOGLE_CLIENT_ID などは書き換えません。
 */
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
const EXAMPLE_PATH = path.join(ROOT, ".env.example");

function readEnvLines() {
  if (fs.existsSync(ENV_PATH)) return fs.readFileSync(ENV_PATH, "utf8").split("\n");
  if (fs.existsSync(EXAMPLE_PATH)) {
    console.log(".env が無いので .env.example から作成します");
    return fs.readFileSync(EXAMPLE_PATH, "utf8").split("\n");
  }
  return [];
}

function getValue(lines, key) {
  const line = lines.find((l) => l.trim().startsWith(`${key}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim() : "";
}

function setValue(lines, key, value) {
  const index = lines.findIndex((l) => l.trim().startsWith(`${key}=`));
  if (index >= 0) {
    lines[index] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }
  return lines;
}

const lines = readEnvLines();

// SESSION_SECRET が空なら生成する
if (getValue(lines, "SESSION_SECRET").length < 32) {
  setValue(lines, "SESSION_SECRET", randomBytes(32).toString("hex"));
  console.log("SESSION_SECRET を自動生成しました");
}

if (!getValue(lines, "DATABASE_URL")) {
  setValue(lines, "DATABASE_URL", '"file:./dev.db"');
}

if (getValue(lines, "DEMO_MODE") !== "1") {
  setValue(lines, "DEMO_MODE", "1");
  console.log("DEMO_MODE=1 を有効にしました");
}

fs.writeFileSync(ENV_PATH, lines.join("\n").replace(/\n{3,}/g, "\n\n"));

console.log("データベースを準備しています…");
execSync("npx prisma generate && npx prisma db push --skip-generate", {
  cwd: ROOT,
  stdio: "inherit",
});

console.log(`
─────────────────────────────────────────────
 準備ができました。次のコマンドで起動してください:

   npm run dev

 ブラウザで http://localhost:3000 を開き、
 「サンプルデータで試す」を押すとすぐに触れます。
 （Google の設定は不要です）

 本番で使うときは README の「セットアップ手順」へ。
 デモを終わりにするには .env の DEMO_MODE=1 を消してください。
─────────────────────────────────────────────
`);
