/**
 * 動作確認用のデモデータを投入します。Gmail に接続しなくても画面を試せます。
 *
 *   node scripts/seed-demo.mjs
 *
 * 実際の Gmail と同期する前に、画面の見え方を確認する用途を想定しています。
 * デモデータだけを消したいときは:  node scripts/seed-demo.mjs --reset
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DEMO_PREFIX = "demo-";

async function reset() {
  const tickets = await prisma.ticket.findMany({
    where: { gmailThreadId: { startsWith: DEMO_PREFIX } },
    select: { id: true },
  });
  const ids = tickets.map((t) => t.id);
  await prisma.ticket.deleteMany({ where: { id: { in: ids } } });
  await prisma.contact.deleteMany({ where: { email: { endsWith: "@example.co.jp" } } });
  console.log(`デモチケット ${ids.length} 件を削除しました。`);
}

async function main() {
  if (process.argv.includes("--reset")) {
    await reset();
    return;
  }

  await reset();

  // ── 担当者 ───────────────────────────────────────────────────
  const me = await prisma.agentIdentity.upsert({
    where: { email: "me@example.com" },
    create: { name: "自分", email: "me@example.com", isMe: true, color: "#2a56c4" },
    update: { isMe: true },
  });

  const saito = await prisma.agentIdentity.upsert({
    where: { email: "saito@example.com" },
    create: { name: "齊藤", email: "saito@example.com", color: "#0f8a6a" },
    update: {},
  });

  await prisma.attributionRule.upsert({
    where: { kind_pattern: { kind: "DELEGATE_EMAIL", pattern: "saito@example.com" } },
    create: {
      agentId: saito.id,
      kind: "DELEGATE_EMAIL",
      pattern: "saito@example.com",
      source: "MANUAL",
      priority: 10,
    },
    update: {},
  });

  // ── 顧客 ─────────────────────────────────────────────────────
  const tanaka = await prisma.contact.upsert({
    where: { email: "tanaka@example.co.jp" },
    create: { email: "tanaka@example.co.jp", name: "田中 花子", company: "株式会社サンプル" },
    update: {},
  });

  const suzuki = await prisma.contact.upsert({
    where: { email: "suzuki@example.co.jp" },
    create: { email: "suzuki@example.co.jp", name: "鈴木 一郎" },
    update: {},
  });

  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const at = (daysAgo, hours = 10) =>
    new Date(now - daysAgo * day + hours * 60 * 60 * 1000 - 10 * 60 * 60 * 1000);

  const support = "support@example.com";

  /* ── チケット 1: 複数人が対応した会話（本題のケース）──────────── */
  const ticket1 = await prisma.ticket.create({
    data: {
      gmailThreadId: `${DEMO_PREFIX}thread-1`,
      subject: "請求書の再発行をお願いします",
      contactId: tanaka.id,
      status: "OPEN",
      priority: "HIGH",
      assigneeId: me.id,
      firstMessageAt: at(6),
      lastMessageAt: at(1, 15),
      messageCount: 5,
      unread: true,
      awaitingReply: true,
      multiAgent: true,
    },
  });

  const messages = [
    {
      direction: "INBOUND",
      fromEmail: tanaka.email,
      fromName: "田中 花子",
      sentAt: at(6),
      bodyHtml:
        '<div style="white-space:pre-wrap">お世話になっております。株式会社サンプルの田中です。\n\n先月分の請求書を紛失してしまいました。\n再発行していただくことは可能でしょうか。\n\nお手数ですがよろしくお願いいたします。</div>',
      bodyText:
        "お世話になっております。株式会社サンプルの田中です。\n先月分の請求書を紛失してしまいました。再発行していただくことは可能でしょうか。",
      snippet: "お世話になっております。株式会社サンプルの田中です。先月分の請求書を紛失してしまい…",
    },
    {
      direction: "OUTBOUND",
      fromEmail: support,
      fromName: "サポート窓口",
      senderEmail: me.email,
      sentAt: at(6, 14),
      authorAgentId: me.id,
      attributionMethod: "APP",
      attributionLocked: true,
      sentViaApp: true,
      bodyHtml:
        '<div style="white-space:pre-wrap">田中様\n\nお問い合わせありがとうございます。\n請求書の再発行を承りました。3営業日ほどでお送りいたします。</div><div style="color:#667085;margin-top:16px">--<br>自分</div>',
      bodyText: "田中様\nお問い合わせありがとうございます。請求書の再発行を承りました。\n\n--\n自分",
      snippet: "田中様 お問い合わせありがとうございます。請求書の再発行を承りました。",
    },
    {
      direction: "INBOUND",
      fromEmail: tanaka.email,
      fromName: "田中 花子",
      sentAt: at(3),
      bodyHtml:
        '<div style="white-space:pre-wrap">ご連絡ありがとうございます。\n\n恐れ入りますが、宛名を「株式会社サンプル 経理部」に変更していただけますでしょうか。</div>',
      bodyText: "ご連絡ありがとうございます。恐れ入りますが、宛名を「株式会社サンプル 経理部」に変更していただけますでしょうか。",
      snippet: "ご連絡ありがとうございます。恐れ入りますが、宛名を変更していただけますでしょうか。",
    },
    {
      // Gmail の委任送信 → Sender ヘッダーから齊藤さんと判別できる
      direction: "OUTBOUND",
      fromEmail: support,
      fromName: "サポート窓口",
      senderEmail: saito.email,
      sentAt: at(2, 11),
      authorAgentId: saito.id,
      attributionMethod: "DELEGATE_HEADER",
      bodyHtml:
        '<div style="white-space:pre-wrap">田中様\n\n本日担当しております齊藤です。\n宛名の変更承りました。修正版をお送りいたします。</div>',
      bodyText: "田中様\n本日担当しております齊藤です。宛名の変更承りました。修正版をお送りいたします。\n\n齊藤\nサンプル株式会社 サポート部",
      snippet: "田中様 本日担当しております齊藤です。宛名の変更承りました。",
    },
    {
      // Gmail から直接送信され、手がかりが無い → 「送信者不明」
      direction: "OUTBOUND",
      fromEmail: support,
      fromName: "サポート窓口",
      senderEmail: null,
      sentAt: at(1, 15),
      authorAgentId: null,
      attributionMethod: "UNKNOWN",
      bodyHtml:
        '<div style="white-space:pre-wrap">田中様\n\n請求書をお送りいたしました。ご確認ください。\n\n引き続きよろしくお願いいたします。</div>',
      bodyText:
        "田中様\n請求書をお送りいたしました。ご確認ください。\n引き続きよろしくお願いいたします。\n\n木村\nサンプル株式会社",
      snippet: "田中様 請求書をお送りいたしました。ご確認ください。",
    },
  ];

  for (const [i, m] of messages.entries()) {
    await prisma.message.create({
      data: {
        gmailMessageId: `${DEMO_PREFIX}msg-1-${i}`,
        gmailThreadId: ticket1.gmailThreadId,
        ticketId: ticket1.id,
        headerMessageId: `<${DEMO_PREFIX}1-${i}@example.com>`,
        subject: ticket1.subject,
        toJson: JSON.stringify([
          { name: null, email: m.direction === "INBOUND" ? support : tanaka.email },
        ]),
        labelsJson: JSON.stringify(m.direction === "INBOUND" ? ["INBOX"] : ["SENT"]),
        ...m,
      },
    });

    await prisma.activityLog.create({
      data: {
        ticketId: ticket1.id,
        type: m.direction === "INBOUND" ? "MESSAGE_RECEIVED" : "MESSAGE_SENT",
        actorId: m.authorAgentId ?? null,
        actorLabel:
          m.direction === "INBOUND"
            ? "田中 花子"
            : m.authorAgentId
              ? null
              : "Gmail から直接送信（送信者不明）",
        detailJson: JSON.stringify({ subject: ticket1.subject }),
        createdAt: m.sentAt,
      },
    });
  }

  await prisma.note.create({
    data: {
      ticketId: ticket1.id,
      authorId: saito.id,
      body: "経理部に再発行を依頼済み。宛名変更の件も伝えてあります。",
      createdAt: at(2, 12),
    },
  });

  /* ── チケット 2: 未返信の新規問い合わせ ─────────────────────── */
  const ticket2 = await prisma.ticket.create({
    data: {
      gmailThreadId: `${DEMO_PREFIX}thread-2`,
      subject: "パスワードがリセットできません",
      contactId: suzuki.id,
      status: "OPEN",
      firstMessageAt: at(0, 9),
      lastMessageAt: at(0, 9),
      messageCount: 1,
      unread: true,
      awaitingReply: true,
    },
  });

  await prisma.message.create({
    data: {
      gmailMessageId: `${DEMO_PREFIX}msg-2-0`,
      gmailThreadId: ticket2.gmailThreadId,
      ticketId: ticket2.id,
      direction: "INBOUND",
      fromEmail: suzuki.email,
      fromName: "鈴木 一郎",
      subject: ticket2.subject,
      sentAt: at(0, 9),
      toJson: JSON.stringify([{ name: null, email: support }]),
      labelsJson: JSON.stringify(["INBOX", "UNREAD"]),
      bodyHtml:
        '<div style="white-space:pre-wrap">パスワードリセットのメールが届きません。\n迷惑メールフォルダも確認しましたが見当たりませんでした。</div>',
      bodyText: "パスワードリセットのメールが届きません。迷惑メールフォルダも確認しましたが見当たりませんでした。",
      snippet: "パスワードリセットのメールが届きません。迷惑メールフォルダも確認しましたが…",
    },
  });

  /* ── チケット 3: 解決済み ───────────────────────────────────── */
  const ticket3 = await prisma.ticket.create({
    data: {
      gmailThreadId: `${DEMO_PREFIX}thread-3`,
      subject: "配送先の住所変更について",
      contactId: tanaka.id,
      status: "SOLVED",
      firstMessageAt: at(20),
      lastMessageAt: at(19),
      messageCount: 2,
      unread: false,
    },
  });

  await prisma.message.createMany({
    data: [
      {
        gmailMessageId: `${DEMO_PREFIX}msg-3-0`,
        gmailThreadId: ticket3.gmailThreadId,
        ticketId: ticket3.id,
        direction: "INBOUND",
        fromEmail: tanaka.email,
        fromName: "田中 花子",
        subject: ticket3.subject,
        sentAt: at(20),
        bodyHtml: '<div style="white-space:pre-wrap">配送先の住所を変更したいのですが、どこから手続きできますか。</div>',
        bodyText: "配送先の住所を変更したいのですが、どこから手続きできますか。",
        snippet: "配送先の住所を変更したいのですが、どこから手続きできますか。",
      },
      {
        gmailMessageId: `${DEMO_PREFIX}msg-3-1`,
        gmailThreadId: ticket3.gmailThreadId,
        ticketId: ticket3.id,
        direction: "OUTBOUND",
        fromEmail: support,
        fromName: "サポート窓口",
        senderEmail: saito.email,
        subject: `Re: ${ticket3.subject}`,
        sentAt: at(19),
        authorAgentId: saito.id,
        attributionMethod: "DELEGATE_HEADER",
        bodyHtml: '<div style="white-space:pre-wrap">マイページの「お届け先設定」から変更いただけます。</div>',
        bodyText: "マイページの「お届け先設定」から変更いただけます。\n\n齊藤",
        snippet: "マイページの「お届け先設定」から変更いただけます。",
      },
    ],
  });

  console.log("デモデータを投入しました:");
  console.log("  チケット 3 件 / 担当者 2 名");
  console.log("  #%d は齊藤さんの返信 1 通と『送信者不明』の返信 1 通を含みます", ticket1.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
