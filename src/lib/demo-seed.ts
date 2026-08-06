import { prisma } from "./prisma";
import { recomputeTicket } from "./ticket-aggregate";

/**
 * デモ用のサンプル会話を作ります。Gmail には接続しません。
 *
 * 「共有アドレスを複数人で使うと誰が返信したか分からなくなる」問題が
 * そのまま再現されるように作ってあります:
 *   - 自分がこのアプリから送った返信      → 送信者が確実に記録されている
 *   - 齊藤さんが Gmail の委任送信で返信   → Sender ヘッダーから自動判別できる
 *   - 誰かが Gmail から直接返信           → 手がかりが無く「送信者不明」になる
 */

const DEMO_PREFIX = "demo-";
const SUPPORT = "support@example.com";

export async function resetDemoData(): Promise<number> {
  const tickets = await prisma.ticket.findMany({
    where: { gmailThreadId: { startsWith: DEMO_PREFIX } },
    select: { id: true },
  });
  const ids = tickets.map((t) => t.id);
  if (ids.length > 0) {
    await prisma.ticket.deleteMany({ where: { id: { in: ids } } });
  }
  await prisma.contact.deleteMany({
    where: { email: { endsWith: "@example.co.jp" }, tickets: { none: {} } },
  });
  return ids.length;
}

export async function hasDemoData(): Promise<boolean> {
  const count = await prisma.ticket.count({
    where: { gmailThreadId: { startsWith: DEMO_PREFIX } },
  });
  return count > 0;
}

export async function seedDemoData(): Promise<{ tickets: number }> {
  await resetDemoData();

  // ── 担当者 ─────────────────────────────────────────────────
  const me =
    (await prisma.agentIdentity.findFirst({ where: { isMe: true } })) ??
    (await prisma.agentIdentity.create({
      data: { name: "自分", email: "me@example.com", isMe: true, color: "#2a56c4" },
    }));

  const saito =
    (await prisma.agentIdentity.findUnique({ where: { email: "saito@example.com" } })) ??
    (await prisma.agentIdentity.create({
      data: { name: "齊藤", email: "saito@example.com", color: "#0f8a6a" },
    }));

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

  // ── 顧客 ───────────────────────────────────────────────────
  const tanaka = await prisma.contact.upsert({
    where: { email: "tanaka@example.co.jp" },
    create: {
      email: "tanaka@example.co.jp",
      name: "田中 花子",
      company: "株式会社サンプル",
    },
    update: {},
  });

  const suzuki = await prisma.contact.upsert({
    where: { email: "suzuki@example.co.jp" },
    create: { email: "suzuki@example.co.jp", name: "鈴木 一郎" },
    update: {},
  });

  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;
  const now = Date.now();
  const at = (daysAgo: number, hours = 10) =>
    new Date(now - daysAgo * day + (hours - 10) * hour);
  /** 未返信の緊急度を確実に再現するため、時間単位でも指定できるようにする */
  const hoursAgo = (h: number) => new Date(now - h * hour);

  /* ── チケット 1: 3人が入り混じった会話（このアプリの本題）──── */
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
      unread: true,
    },
  });

  const thread1 = [
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
      senderEmail: null,
      authorAgentId: null,
      attributionMethod: "UNKNOWN",
      attributionLocked: false,
      sentViaApp: false,
    },
    {
      // このアプリから送信 → 送信者が確実に残る
      direction: "OUTBOUND",
      fromEmail: SUPPORT,
      fromName: "サポート窓口",
      senderEmail: me.email,
      sentAt: at(6, 14),
      authorAgentId: me.id,
      attributionMethod: "APP",
      attributionLocked: true,
      sentViaApp: true,
      bodyHtml:
        '<div style="white-space:pre-wrap">田中様\n\nお問い合わせありがとうございます。\n請求書の再発行を承りました。3営業日ほどでお送りいたします。</div><div style="color:#667085;margin-top:16px">--<br>自分</div>',
      bodyText:
        "田中様\nお問い合わせありがとうございます。請求書の再発行を承りました。\n\n--\n自分",
      snippet: "田中様 お問い合わせありがとうございます。請求書の再発行を承りました。",
    },
    {
      direction: "INBOUND",
      fromEmail: tanaka.email,
      fromName: "田中 花子",
      sentAt: at(3),
      bodyHtml:
        '<div style="white-space:pre-wrap">ご連絡ありがとうございます。\n\n恐れ入りますが、宛名を「株式会社サンプル 経理部」に変更していただけますでしょうか。</div>',
      bodyText:
        "ご連絡ありがとうございます。恐れ入りますが、宛名を「株式会社サンプル 経理部」に変更していただけますでしょうか。",
      snippet: "ご連絡ありがとうございます。恐れ入りますが、宛名を変更していただけますでしょうか。",
      senderEmail: null,
      authorAgentId: null,
      attributionMethod: "UNKNOWN",
      attributionLocked: false,
      sentViaApp: false,
    },
    {
      // Gmail の委任送信 → Sender ヘッダーから齊藤さんと判別
      direction: "OUTBOUND",
      fromEmail: SUPPORT,
      fromName: "サポート窓口",
      senderEmail: saito.email,
      sentAt: at(2, 11),
      authorAgentId: saito.id,
      attributionMethod: "DELEGATE_HEADER",
      attributionLocked: false,
      sentViaApp: false,
      bodyHtml:
        '<div style="white-space:pre-wrap">田中様\n\n本日担当しております齊藤です。\n宛名の変更承りました。修正版をお送りいたします。</div>',
      bodyText:
        "田中様\n本日担当しております齊藤です。宛名の変更承りました。修正版をお送りいたします。\n\n齊藤\nサンプル株式会社 サポート部",
      snippet: "田中様 本日担当しております齊藤です。宛名の変更承りました。",
    },
    {
      // Gmail から直接送信され、手がかりが無い → 「送信者不明」
      direction: "OUTBOUND",
      fromEmail: SUPPORT,
      fromName: "サポート窓口",
      senderEmail: null,
      sentAt: at(1, 15),
      authorAgentId: null,
      attributionMethod: "UNKNOWN",
      attributionLocked: false,
      sentViaApp: false,
      bodyHtml:
        '<div style="white-space:pre-wrap">田中様\n\n請求書をお送りいたしました。ご確認ください。\n\n引き続きよろしくお願いいたします。</div>',
      bodyText:
        "田中様\n請求書をお送りいたしました。ご確認ください。\n引き続きよろしくお願いいたします。\n\n木村\nサンプル株式会社",
      snippet: "田中様 請求書をお送りいたしました。ご確認ください。",
    },
  ];

  for (const [i, m] of thread1.entries()) {
    await prisma.message.create({
      data: {
        gmailMessageId: `${DEMO_PREFIX}msg-1-${i}`,
        gmailThreadId: ticket1.gmailThreadId,
        ticketId: ticket1.id,
        headerMessageId: `<${DEMO_PREFIX}1-${i}@example.com>`,
        subject: ticket1.subject,
        toJson: JSON.stringify([
          { name: null, email: m.direction === "INBOUND" ? SUPPORT : tanaka.email },
        ]),
        labelsJson: JSON.stringify(m.direction === "INBOUND" ? ["INBOX"] : ["SENT"]),
        ...m,
      },
    });

    await prisma.activityLog.create({
      data: {
        ticketId: ticket1.id,
        type: m.direction === "INBOUND" ? "MESSAGE_RECEIVED" : "MESSAGE_SENT",
        actorId: m.authorAgentId,
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

  /* ── チケット 2: 未返信の新規問い合わせ ─────────────────── */
  const ticket2 = await prisma.ticket.create({
    data: {
      gmailThreadId: `${DEMO_PREFIX}thread-2`,
      subject: "パスワードがリセットできません",
      contactId: suzuki.id,
      status: "OPEN",
      firstMessageAt: hoursAgo(10),
      lastMessageAt: hoursAgo(10),
      unread: true,
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
      sentAt: hoursAgo(10),
      toJson: JSON.stringify([{ name: null, email: SUPPORT }]),
      labelsJson: JSON.stringify(["INBOX", "UNREAD"]),
      bodyHtml:
        '<div style="white-space:pre-wrap">パスワードリセットのメールが届きません。\n迷惑メールフォルダも確認しましたが見当たりませんでした。</div>',
      bodyText:
        "パスワードリセットのメールが届きません。迷惑メールフォルダも確認しましたが見当たりませんでした。",
      snippet: "パスワードリセットのメールが届きません。迷惑メールフォルダも確認しましたが…",
    },
  });

  await prisma.activityLog.create({
    data: {
      ticketId: ticket2.id,
      type: "MESSAGE_RECEIVED",
      actorLabel: "鈴木 一郎",
      detailJson: JSON.stringify({ subject: ticket2.subject }),
      createdAt: hoursAgo(10),
    },
  });

  /* ── チケット 3: 解決済み ───────────────────────────────── */
  const ticket3 = await prisma.ticket.create({
    data: {
      gmailThreadId: `${DEMO_PREFIX}thread-3`,
      subject: "配送先の住所変更について",
      contactId: tanaka.id,
      status: "SOLVED",
      firstMessageAt: at(20),
      lastMessageAt: at(19),
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
        bodyHtml:
          '<div style="white-space:pre-wrap">配送先の住所を変更したいのですが、どこから手続きできますか。</div>',
        bodyText: "配送先の住所を変更したいのですが、どこから手続きできますか。",
        snippet: "配送先の住所を変更したいのですが、どこから手続きできますか。",
      },
      {
        gmailMessageId: `${DEMO_PREFIX}msg-3-1`,
        gmailThreadId: ticket3.gmailThreadId,
        ticketId: ticket3.id,
        direction: "OUTBOUND",
        fromEmail: SUPPORT,
        fromName: "サポート窓口",
        senderEmail: saito.email,
        subject: `Re: ${ticket3.subject}`,
        sentAt: at(19),
        authorAgentId: saito.id,
        attributionMethod: "DELEGATE_HEADER",
        bodyHtml:
          '<div style="white-space:pre-wrap">マイページの「お届け先設定」から変更いただけます。</div>',
        bodyText: "マイページの「お届け先設定」から変更いただけます。\n\n齊藤",
        snippet: "マイページの「お届け先設定」から変更いただけます。",
      },
    ],
  });

  /* ── チケット 4: 届いたばかり（まだ段階なし）───────────── */
  const kato = await prisma.contact.upsert({
    where: { email: "kato@example.co.jp" },
    create: { email: "kato@example.co.jp", name: "加藤 美咲" },
    update: {},
  });

  const ticket4 = await prisma.ticket.create({
    data: {
      gmailThreadId: `${DEMO_PREFIX}thread-4`,
      subject: "領収書の宛名を変更したいです",
      contactId: kato.id,
      status: "OPEN",
      firstMessageAt: hoursAgo(1),
      lastMessageAt: hoursAgo(1),
      unread: true,
    },
  });

  await prisma.message.create({
    data: {
      gmailMessageId: `${DEMO_PREFIX}msg-4-0`,
      gmailThreadId: ticket4.gmailThreadId,
      ticketId: ticket4.id,
      direction: "INBOUND",
      fromEmail: kato.email,
      fromName: "加藤 美咲",
      subject: ticket4.subject,
      sentAt: hoursAgo(1),
      toJson: JSON.stringify([{ name: null, email: SUPPORT }]),
      labelsJson: JSON.stringify(["INBOX", "UNREAD"]),
      bodyHtml:
        '<div style="white-space:pre-wrap">先ほど購入した分の領収書について、宛名を法人名に変更していただけますか。</div>',
      bodyText: "先ほど購入した分の領収書について、宛名を法人名に変更していただけますか。",
      snippet: "先ほど購入した分の領収書について、宛名を法人名に変更していただけますか。",
    },
  });

  /* ── チケット 5: 3日以上放置（重大な遅れ）──────────────── */
  const watanabe = await prisma.contact.upsert({
    where: { email: "watanabe@example.co.jp" },
    create: { email: "watanabe@example.co.jp", name: "渡辺 健" },
    update: {},
  });

  const ticket5 = await prisma.ticket.create({
    data: {
      gmailThreadId: `${DEMO_PREFIX}thread-5`,
      subject: "解約手続きについて教えてください",
      contactId: watanabe.id,
      status: "OPEN",
      firstMessageAt: hoursAgo(80),
      lastMessageAt: hoursAgo(80),
      unread: true,
    },
  });

  await prisma.message.create({
    data: {
      gmailMessageId: `${DEMO_PREFIX}msg-5-0`,
      gmailThreadId: ticket5.gmailThreadId,
      ticketId: ticket5.id,
      direction: "INBOUND",
      fromEmail: watanabe.email,
      fromName: "渡辺 健",
      subject: ticket5.subject,
      sentAt: hoursAgo(80),
      toJson: JSON.stringify([{ name: null, email: SUPPORT }]),
      labelsJson: JSON.stringify(["INBOX", "UNREAD"]),
      bodyHtml:
        '<div style="white-space:pre-wrap">解約の手続き方法を教えてください。\n期限が近いため急ぎ確認したいです。</div>',
      bodyText: "解約の手続き方法を教えてください。期限が近いため急ぎ確認したいです。",
      snippet: "解約の手続き方法を教えてください。期限が近いため急ぎ確認したいです。",
    },
  });

  /* ── チケット 6: 30時間未返信（遅延）──────────────────── */
  const ticket6 = await prisma.ticket.create({
    data: {
      gmailThreadId: `${DEMO_PREFIX}thread-6`,
      subject: "納品書のPDFが開けません",
      contactId: suzuki.id,
      status: "OPEN",
      firstMessageAt: hoursAgo(30),
      lastMessageAt: hoursAgo(30),
      unread: true,
    },
  });

  await prisma.message.create({
    data: {
      gmailMessageId: `${DEMO_PREFIX}msg-6-0`,
      gmailThreadId: ticket6.gmailThreadId,
      ticketId: ticket6.id,
      direction: "INBOUND",
      fromEmail: suzuki.email,
      fromName: "鈴木 一郎",
      subject: ticket6.subject,
      sentAt: hoursAgo(30),
      toJson: JSON.stringify([{ name: null, email: SUPPORT }]),
      labelsJson: JSON.stringify(["INBOX", "UNREAD"]),
      bodyHtml:
        '<div style="white-space:pre-wrap">送っていただいた納品書のPDFが破損しているようで開けません。\n再送していただけますか。</div>',
      bodyText: "送っていただいた納品書のPDFが破損しているようで開けません。再送していただけますか。",
      snippet: "送っていただいた納品書のPDFが破損しているようで開けません。再送していただけますか。",
    },
  });

  // 集計値は手書きせず、実際の同期と同じロジックで確定させる
  for (const t of [ticket1, ticket2, ticket3, ticket4, ticket5, ticket6]) {
    await recomputeTicket(t.gmailThreadId);
  }

  return { tickets: 6 };
}
