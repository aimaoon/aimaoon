/**
 * API の結合テスト。
 *
 *   npm run dev      # 別のターミナルで起動しておく
 *   npm run test:api
 *
 * サンプルデータは毎回入れ直すので、事前準備は不要です。
 * Gmail への実送信だけは本物のアカウントが必要なため検証対象外です。
 */
import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { createTestSession } from "./session.mjs";

// テストが前回の実行結果に影響されないよう、毎回まっさらなサンプルデータから始める
execSync("npm run seed:demo", { stdio: "pipe" });

const prisma = new PrismaClient();
const { cookie } = await createTestSession(prisma);
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const H = { "Content-Type": "application/json", Cookie: cookie };

let pass = 0;
let fail = 0;
const check = (label, ok, extra = "") => {
  console.log(`${ok ? "  OK  " : " FAIL "} ${label}${extra ? ` — ${extra}` : ""}`);
  ok ? pass++ : fail++;
};

const call = async (path, options = {}) => {
  const res = await fetch(`${BASE}${path}`, { headers: H, ...options });
  return { status: res.status, json: await res.json().catch(() => null) };
};

// ── 認証 ───────────────────────────────────────────────────────
const noAuth = await fetch(`${BASE}/api/tickets`);
check("未ログインでは 401", noAuth.status === 401, `status=${noAuth.status}`);

// ── 一覧・絞り込み ─────────────────────────────────────────────
const list = await call("/api/tickets?status=OPEN");
check("一覧が返る", list.json?.ok && list.json.data.items.length === 2, `${list.json?.data?.items?.length} 件`);

const multi = await call("/api/tickets?status=ALL&view=multiAgent");
check("複数人対応で絞り込める", multi.json?.data?.items?.length === 1);

const unknown = await call("/api/tickets?status=ALL&view=unknownSender");
check("送信者不明で絞り込める", unknown.json?.data?.items?.length === 1);

const search = await call("/api/tickets?status=ALL&q=" + encodeURIComponent("パスワード"));
check("本文検索がヒットする", search.json?.data?.items?.length === 1);

const searchMiss = await call("/api/tickets?status=ALL&q=" + encodeURIComponent("存在しない語句xyz"));
check("該当なしは 0 件", searchMiss.json?.data?.items?.length === 0);

const t1 = list.json.data.items.find((t) => t.subject.includes("請求書"));
check("返信者の内訳が付く", t1?.responders?.length === 3, JSON.stringify(t1?.responders?.map((r) => r.name)));

// ── ステータス変更 ─────────────────────────────────────────────
const patch = await call(`/api/tickets/${t1.id}`, {
  method: "PATCH",
  body: JSON.stringify({ status: "PENDING", priority: "URGENT" }),
});
check("ステータス・優先度を変更できる", patch.json?.ok);

const afterPatch = await prisma.ticket.findUnique({ where: { id: t1.id } });
check("DB に反映される", afterPatch.status === "PENDING" && afterPatch.priority === "URGENT");

const logs = await prisma.activityLog.findMany({
  where: { ticketId: t1.id, type: { in: ["STATUS_CHANGED", "PRIORITY_CHANGED"] } },
});
check("履歴が残る", logs.length === 2, `${logs.length} 件`);

const badStatus = await call(`/api/tickets/${t1.id}`, {
  method: "PATCH",
  body: JSON.stringify({ status: "NOPE" }),
});
check("不正なステータスは弾く", badStatus.status === 400);

await call(`/api/tickets/${t1.id}`, { method: "PATCH", body: JSON.stringify({ status: "OPEN" }) });

// ── 社内メモ ───────────────────────────────────────────────────
const note = await call(`/api/tickets/${t1.id}/notes`, {
  method: "POST",
  body: JSON.stringify({ body: "テスト用のメモです" }),
});
check("社内メモを追加できる", note.json?.ok && note.json.data.author?.name);

const emptyNote = await call(`/api/tickets/${t1.id}/notes`, {
  method: "POST",
  body: JSON.stringify({ body: "   " }),
});
check("空メモは弾く", emptyNote.status === 400);

// ── 送信者の手動設定と学習 ────────────────────────────────────
const kimura = await prisma.agentIdentity.create({
  data: { name: "木村", color: "#b4530a" },
});

const unknownMsg = await prisma.message.findFirst({
  where: { ticketId: t1.id, direction: "OUTBOUND", authorAgentId: null },
});
check("送信者不明のメールが存在する", !!unknownMsg);

const setAuthor = await call(`/api/messages/${unknownMsg.id}/author`, {
  method: "PATCH",
  body: JSON.stringify({ agentId: kimura.id, learnSignature: "木村" }),
});
check("送信者を手動設定できる", setAuthor.json?.ok, JSON.stringify(setAuthor.json?.data));
check("学習した内容が返る", setAuthor.json?.data?.learned?.length === 1);

const afterAuthor = await prisma.message.findUnique({ where: { id: unknownMsg.id } });
check(
  "MANUAL として記録され、ロックされる",
  afterAuthor.authorAgentId === kimura.id &&
    afterAuthor.attributionMethod === "MANUAL" &&
    afterAuthor.attributionLocked === true
);

const rule = await prisma.attributionRule.findFirst({
  where: { kind: "SIGNATURE_CONTAINS", pattern: "木村" },
});
check("署名ルールが学習される", rule?.agentId === kimura.id);

const authorLog = await prisma.activityLog.findFirst({
  where: { ticketId: t1.id, type: "AUTHOR_SET" },
});
check("送信者設定の履歴が残る", !!authorLog);

// ── ルールが新しいメールに効くか ──────────────────────────────
const t3 = await prisma.ticket.findFirst({ where: { gmailThreadId: "demo-thread-3" } });
const probe = await prisma.message.create({
  data: {
    gmailMessageId: "test-probe-1",
    gmailThreadId: t3.gmailThreadId,
    ticketId: t3.id,
    direction: "OUTBOUND",
    fromEmail: "support@example.com",
    subject: "テスト",
    sentAt: new Date(),
    bodyText: "ご確認ください。\n\n木村\nサンプル株式会社",
    attributionMethod: "UNKNOWN",
  },
});

const rules = await call("/api/rules");
check("ルール一覧が取れる", rules.json?.ok && rules.json.data.length >= 2);

// ルールを再適用させる（ルール追加 API が全件再判定を行う）
const addRule = await call("/api/rules", {
  method: "POST",
  body: JSON.stringify({ kind: "FROM_NAME", pattern: "テスト用", agentId: kimura.id }),
});
check("ルールを追加できる", addRule.json?.ok);

const afterProbe = await prisma.message.findUnique({ where: { id: probe.id } });
check(
  "署名ルールで過去メールが自動判別される",
  afterProbe.authorAgentId === kimura.id &&
    afterProbe.attributionMethod === "SIGNATURE_RULE",
  `author=${afterProbe.authorAgentId} method=${afterProbe.attributionMethod}`
);

const lockedStill = await prisma.message.findUnique({ where: { id: unknownMsg.id } });
check("手動設定は再判定で上書きされない", lockedStill.attributionMethod === "MANUAL");

// ── 担当者 API ─────────────────────────────────────────────────
const dupe = await call("/api/agents", {
  method: "POST",
  body: JSON.stringify({ name: "重複テスト", email: "saito@example.com" }),
});
check("重複アドレスの担当者は弾く", dupe.status === 400);

const me = await prisma.agentIdentity.findFirst({ where: { isMe: true } });
const delMe = await call(`/api/agents/${me.id}`, { method: "DELETE" });
check("ログイン本人は削除できない", delMe.status === 400);

// ── 後片付け ───────────────────────────────────────────────────
await prisma.message.delete({ where: { id: probe.id } });
await prisma.attributionRule.deleteMany({ where: { agentId: kimura.id } });
await prisma.message.updateMany({
  where: { authorAgentId: kimura.id },
  data: { authorAgentId: null, attributionMethod: "UNKNOWN", attributionLocked: false },
});
await prisma.agentIdentity.delete({ where: { id: kimura.id } });
await prisma.note.deleteMany({ where: { body: "テスト用のメモです" } });

console.log(`\n${pass} 件成功 / ${fail} 件失敗`);
await prisma.$disconnect();
process.exit(fail > 0 ? 1 : 0);
