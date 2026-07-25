/**
 * 純粋関数のテスト（DB もネットワークも使いません）。
 *
 *   npm run test:unit
 *
 * 日本語メールの文字コード、引用の切り離し、送信者の判別ロジックを検証します。
 */
import {
  decodeMimeWords,
  parseAddressList,
  splitQuotedText,
  splitQuotedHtml,
  sanitizeEmailHtml,
  extractBody,
} from "../src/lib/mime.ts";
import { normalizeSubject } from "../src/lib/sync.ts";
import { suggestSignaturePatterns, attributeOutbound } from "../src/lib/attribution.ts";

let pass = 0;
let fail = 0;
const eq = (label: string, actual: unknown, expected: unknown) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  console.log(`${ok ? "  OK  " : " FAIL "} ${label}`);
  if (!ok) console.log(`        期待: ${JSON.stringify(expected)}\n        実際: ${JSON.stringify(actual)}`);
  ok ? pass++ : fail++;
};
const ok = (label: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "  OK  " : " FAIL "} ${label}${extra ? ` — ${extra}` : ""}`);
  cond ? pass++ : fail++;
};

console.log("── ヘッダーの日本語デコード ──");
eq(
  "UTF-8 Base64",
  decodeMimeWords("=?UTF-8?B?" + Buffer.from("田中 花子", "utf8").toString("base64") + "?="),
  "田中 花子"
);
{
  // ESC $ B ... ESC ( B で囲まれた JIS X 0208（日本語メールの定番エンコード）
  const iso2022jp = Buffer.from([
    0x1b, 0x24, 0x42, 0x46, 0x7c, 0x4b, 0x5c, 0x38, 0x6c, 0x1b, 0x28, 0x42,
  ]);
  eq(
    "ISO-2022-JP Base64",
    decodeMimeWords(`=?ISO-2022-JP?B?${iso2022jp.toString("base64")}?=`),
    "日本語"
  );
}
{
  const shiftJis = Buffer.from([0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea]);
  eq(
    "Shift_JIS Base64",
    decodeMimeWords(`=?Shift_JIS?B?${shiftJis.toString("base64")}?=`),
    "日本語"
  );
}
{
  const eucJp = Buffer.from([0xc6, 0xfc, 0xcb, 0xdc, 0xb8, 0xec]);
  eq("EUC-JP Base64", decodeMimeWords(`=?EUC-JP?B?${eucJp.toString("base64")}?=`), "日本語");
}
eq(
  "未知の文字コードでも落ちない",
  typeof decodeMimeWords("=?X-UNKNOWN-CHARSET?B?YWJj?="),
  "string"
);
eq("Q エンコード", decodeMimeWords("=?UTF-8?Q?Yamada=20Taro?="), "Yamada Taro");
eq("エンコードなしはそのまま", decodeMimeWords("Plain Subject"), "Plain Subject");
eq(
  "連続するエンコードワードを連結",
  decodeMimeWords(
    "=?UTF-8?B?" + Buffer.from("株式会社", "utf8").toString("base64") + "?= =?UTF-8?B?" +
      Buffer.from("サンプル", "utf8").toString("base64") + "?="
  ),
  "株式会社サンプル"
);

console.log("\n── アドレス解析 ──");
eq(
  "名前付き 1 件",
  parseAddressList('"田中 花子" <tanaka@example.co.jp>'),
  [{ name: "田中 花子", email: "tanaka@example.co.jp" }]
);
eq(
  "カンマを含む名前を誤分割しない",
  parseAddressList('"Yamada, Taro" <taro@example.com>, hanako@example.com'),
  [
    { name: "Yamada, Taro", email: "taro@example.com" },
    { name: null, email: "hanako@example.com" },
  ]
);
eq(
  "エンコードされた名前",
  parseAddressList("=?UTF-8?B?" + Buffer.from("鈴木", "utf8").toString("base64") + "?= <s@example.com>"),
  [{ name: "鈴木", email: "s@example.com" }]
);
eq("アドレスは小文字化", parseAddressList("<Foo@Example.COM>"), [
  { name: null, email: "foo@example.com" },
]);
eq("空ヘッダー", parseAddressList(null), []);

console.log("\n── 引用の切り離し ──");
{
  const r = splitQuotedText(
    "ご連絡ありがとうございます。\n承知いたしました。\n\n2026年7月20日(月) 10:00 田中 花子 <t@example.jp>:\n> 元のメール本文\n> 続き"
  );
  ok("日本語の引用ヘッダーで分割", r.quoted !== null && r.main.includes("承知いたしました") && !r.main.includes("元のメール"));
}
{
  const r = splitQuotedText("Thanks!\n\nOn Mon, Jul 20, 2026 at 10:00 AM Foo <f@e.com> wrote:\n> hi");
  ok("英語の On ... wrote: で分割", r.quoted !== null && r.main.trim() === "Thanks!");
}
{
  const r = splitQuotedText("引用のないメールです。");
  ok("引用がなければ分割しない", r.quoted === null && r.main === "引用のないメールです。");
}
{
  const r = splitQuotedHtml('<div>新しい返信</div><div class="gmail_quote">古い履歴</div>');
  ok("gmail_quote で分割", r.quoted !== null && r.main === "<div>新しい返信</div>");
}
{
  const r = splitQuotedHtml('<div class="gmail_quote">引用しかない</div>');
  ok("引用しかない場合は分割しない", r.quoted === null);
}

console.log("\n── サニタイズ ──");
ok("script を除去", !sanitizeEmailHtml('<p>hi</p><script>alert(1)</script>').includes("script"));
ok(
  "javascript: リンクを除去",
  !sanitizeEmailHtml('<a href="javascript:alert(1)">x</a>').includes("javascript:")
);
ok("onerror 属性を除去", !sanitizeEmailHtml('<img src="x" onerror="alert(1)">').includes("onerror"));
ok("外部リンクに rel を付ける", sanitizeEmailHtml('<a href="https://e.com">x</a>').includes("noopener"));
ok("表は残す", sanitizeEmailHtml("<table><tr><td>a</td></tr></table>").includes("<td>"));
ok(
  "cid: 画像はプレースホルダーになる",
  sanitizeEmailHtml('<img src="cid:abc123">').includes("埋め込み画像")
);

console.log("\n── 本文の取り出し ──");
{
  const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
  const body = extractBody({
    mimeType: "multipart/mixed",
    parts: [
      {
        mimeType: "multipart/alternative",
        parts: [
          { mimeType: "text/plain", body: { data: b64("プレーン本文") } },
          { mimeType: "text/html", body: { data: b64("<p>HTML 本文</p>") } },
        ],
      },
      {
        mimeType: "application/pdf",
        filename: "請求書.pdf",
        body: { size: 12345, attachmentId: "att-1" },
        headers: [{ name: "Content-Disposition", value: 'attachment; filename="seikyu.pdf"' }],
      },
    ],
  });
  eq("入れ子の text/plain を取得", body.text, "プレーン本文");
  eq("入れ子の text/html を取得", body.html, "<p>HTML 本文</p>");
  eq("添付を検出", body.attachments.length, 1);
  eq("添付ファイル名", body.attachments[0].filename, "請求書.pdf");
}
{
  // 本文自体が Shift_JIS の場合（古いメールソフトからの問い合わせ）
  const shiftJisBody = Buffer.from([0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea]);
  const body = extractBody({
    mimeType: "text/plain",
    headers: [{ name: "Content-Type", value: "text/plain; charset=Shift_JIS" }],
    body: { data: shiftJisBody.toString("base64url") },
  });
  eq("Shift_JIS の本文を復号", body.text, "日本語");
}
{
  // charset 指定が無ければ UTF-8 として扱う
  const body = extractBody({
    mimeType: "text/plain",
    body: { data: Buffer.from("こんにちは", "utf8").toString("base64url") },
  });
  eq("charset 未指定は UTF-8 扱い", body.text, "こんにちは");
}

console.log("\n── 件名の正規化 ──");
eq("Re: を除去", normalizeSubject("Re: 請求書について"), "請求書について");
eq("多重 Re/Fwd を除去", normalizeSubject("Re: Fwd: Re: 見積もり"), "見積もり");
eq("Re: だけの件名は残す", normalizeSubject("Re:"), "Re:");
eq("接頭辞がなければそのまま", normalizeSubject("新規のお問い合わせ"), "新規のお問い合わせ");

console.log("\n── 署名候補の抽出 ──");
{
  const s = suggestSignaturePatterns(
    "ご確認ください。\n\n--\n木村 健一\nサンプル株式会社 サポート部\nTEL: 03-1234-5678\nkimura@example.com\nhttps://example.com"
  );
  ok("氏名を候補に含む", s.includes("木村 健一"), JSON.stringify(s));
  ok("メールアドレスは除外", !s.some((x) => x.includes("@")));
  ok("URL は除外", !s.some((x) => x.startsWith("http")));
  ok("電話番号だけの行は除外", !s.some((x) => /^[\d\s()+-]+$/.test(x)));
}

console.log("\n── 送信者の判別 ──");
{
  const ctx = {
    rules: [
      { id: "r1", agentId: "a-kimura", kind: "SIGNATURE_CONTAINS", pattern: "木村", priority: 30 },
      { id: "r2", agentId: "a-yamada", kind: "FROM_NAME", pattern: "山田", priority: 20 },
    ],
    agentsByEmail: new Map([["saito@example.com", "a-saito"]]),
    meAgentId: "a-me",
    ownAddresses: new Set(["support@example.com"]),
  };

  eq(
    "委任送信の Sender ヘッダーが最優先",
    attributeOutbound(
      { fromEmail: "support@example.com", fromName: "山田", senderEmail: "saito@example.com", bodyText: "木村です" },
      ctx
    ),
    { agentId: "a-saito", method: "DELEGATE_HEADER", evidence: "saito@example.com" }
  );

  eq(
    "送信者名は署名より優先",
    attributeOutbound(
      { fromEmail: "support@example.com", fromName: "サポート 山田", senderEmail: null, bodyText: "木村です" },
      ctx
    ),
    { agentId: "a-yamada", method: "FROM_NAME", evidence: "サポート 山田" }
  );

  eq(
    "署名で判別",
    attributeOutbound(
      { fromEmail: "support@example.com", fromName: "サポート窓口", senderEmail: null, bodyText: "よろしくお願いします。\n木村" },
      ctx
    ),
    { agentId: "a-kimura", method: "SIGNATURE_RULE", evidence: "木村" }
  );

  eq(
    "手がかりがなければ不明",
    attributeOutbound(
      { fromEmail: "support@example.com", fromName: "サポート窓口", senderEmail: null, bodyText: "ご確認ください" },
      ctx
    ),
    { agentId: null, method: "UNKNOWN", evidence: null }
  );

  const unknownDelegate = attributeOutbound(
    { fromEmail: "support@example.com", fromName: null, senderEmail: "new@example.com", bodyText: "" },
    ctx
  );
  ok(
    "未知の委任アドレスは evidence として返す",
    unknownDelegate.agentId === null && unknownDelegate.evidence === "new@example.com"
  );

  eq(
    "Sender が From と同じなら委任ではない",
    attributeOutbound(
      { fromEmail: "support@example.com", fromName: "サポート窓口", senderEmail: "support@example.com", bodyText: "木村" },
      ctx
    ).method,
    "SIGNATURE_RULE"
  );
}

console.log(`\n${pass} 件成功 / ${fail} 件失敗`);
process.exit(fail > 0 ? 1 : 0);
