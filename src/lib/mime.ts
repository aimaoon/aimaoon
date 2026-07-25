import sanitizeHtml from "sanitize-html";
import type { gmail_v1 } from "googleapis";

export type EmailAddress = { name: string | null; email: string };

export type Attachment = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string | null;
};

/* ────────────────────────────────────────────────────────────────
 * 文字コードまわり
 * ──────────────────────────────────────────────────────────────── */

/** Node は full-ICU 同梱なので ISO-2022-JP / Shift_JIS / EUC-JP も復号できる */
function decodeBuffer(buf: Buffer, charset?: string | null): string {
  const cs = (charset || "utf-8").toLowerCase().replace(/["']/g, "").trim();
  try {
    return new TextDecoder(cs).decode(buf);
  } catch {
    try {
      return new TextDecoder("utf-8").decode(buf);
    } catch {
      return buf.toString("utf8");
    }
  }
}

function base64UrlToBuffer(data: string): Buffer {
  return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function decodeQuotedPrintable(input: string): Buffer {
  const bytes: number[] = [];
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "=" && i + 2 < input.length) {
      const hex = input.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    if (ch === "_") {
      // RFC 2047 の Q エンコードではアンダースコアが空白を表す
      bytes.push(0x20);
      continue;
    }
    bytes.push(ch.charCodeAt(0) & 0xff);
  }
  return Buffer.from(bytes);
}

/**
 * RFC 2047 のエンコードワードを復号する。
 * 日本語の差出人名（=?UTF-8?B?...?= や =?ISO-2022-JP?B?...?=）を読めるようにするために必須。
 */
export function decodeMimeWords(input: string | null | undefined): string {
  if (!input) return "";
  // 連続するエンコードワードの間の空白は取り除く（RFC 2047）
  const collapsed = input.replace(/\?=\s+=\?/g, "?==?");

  return collapsed.replace(
    /=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g,
    (_match, charset: string, encoding: string, text: string) => {
      try {
        const buf =
          encoding.toUpperCase() === "B"
            ? Buffer.from(text, "base64")
            : decodeQuotedPrintable(text);
        return decodeBuffer(buf, charset);
      } catch {
        return text;
      }
    }
  );
}

/* ────────────────────────────────────────────────────────────────
 * ヘッダー
 * ──────────────────────────────────────────────────────────────── */

export function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string | null {
  if (!headers) return null;
  const lower = name.toLowerCase();
  const found = headers.find((h) => (h.name ?? "").toLowerCase() === lower);
  return found?.value ?? null;
}

/**
 * アドレスヘッダーを分解する。
 * `"山田 太郎" <taro@example.com>, hanako@example.com` のような形式に対応。
 */
export function parseAddressList(raw: string | null | undefined): EmailAddress[] {
  if (!raw) return [];

  const parts: string[] = [];
  let current = "";
  let inQuotes = false;
  let inAngle = false;

  for (const ch of raw) {
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === "<" && !inQuotes) inAngle = true;
    else if (ch === ">" && !inQuotes) inAngle = false;

    if (ch === "," && !inQuotes && !inAngle) {
      parts.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current);

  const results: EmailAddress[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    const angle = trimmed.match(/^(.*?)<([^>]+)>\s*$/);
    if (angle) {
      let name = decodeMimeWords(angle[1].trim()).trim();
      if (name.startsWith('"') && name.endsWith('"') && name.length > 1) {
        name = name.slice(1, -1);
      }
      const email = angle[2].trim().toLowerCase();
      if (email) results.push({ name: name || null, email });
      continue;
    }

    const bare = trimmed.replace(/^["']|["']$/g, "").trim().toLowerCase();
    if (bare.includes("@")) results.push({ name: null, email: bare });
  }

  return results;
}

export function parseSingleAddress(raw: string | null | undefined): EmailAddress | null {
  return parseAddressList(raw)[0] ?? null;
}

/* ────────────────────────────────────────────────────────────────
 * 本文の取り出し
 * ──────────────────────────────────────────────────────────────── */

type ExtractedBody = {
  html: string | null;
  text: string | null;
  attachments: Attachment[];
};

/** MIME ツリーを再帰的に辿って本文と添付を集める */
export function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): ExtractedBody {
  const result: ExtractedBody = { html: null, text: null, attachments: [] };
  if (!payload) return result;

  const walk = (part: gmail_v1.Schema$MessagePart, depth: number) => {
    if (depth > 20) return; // 壊れたメールでの無限再帰よけ

    const mimeType = (part.mimeType || "").toLowerCase();
    const filename = part.filename || "";
    const charset = getHeader(part.headers, "content-type")?.match(
      /charset=([^;]+)/i
    )?.[1];

    const disposition = getHeader(part.headers, "content-disposition") || "";
    const isAttachment =
      filename.length > 0 && !disposition.toLowerCase().startsWith("inline");

    if (isAttachment) {
      result.attachments.push({
        filename: decodeMimeWords(filename),
        mimeType: part.mimeType || "application/octet-stream",
        size: part.body?.size ?? 0,
        attachmentId: part.body?.attachmentId ?? null,
      });
      // 添付でも中身が multipart なことがあるので子は辿る
    }

    if (!isAttachment && part.body?.data) {
      const decoded = decodeBuffer(base64UrlToBuffer(part.body.data), charset);
      // 最初に見つかったものを採用する（マルチパートは上位ほど本命）
      if (mimeType === "text/html" && result.html === null) {
        result.html = decoded;
      } else if (mimeType === "text/plain" && result.text === null) {
        result.text = decoded;
      }
    }

    for (const child of part.parts ?? []) {
      walk(child, depth + 1);
    }
  };

  walk(payload, 0);
  return result;
}

/* ────────────────────────────────────────────────────────────────
 * サニタイズ
 * ──────────────────────────────────────────────────────────────── */

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "div", "span", "br", "hr", "a", "b", "strong", "i", "em", "u", "s",
    "ul", "ol", "li", "blockquote", "pre", "code", "img",
    "table", "thead", "tbody", "tfoot", "tr", "td", "th", "caption",
    "h1", "h2", "h3", "h4", "h5", "h6", "small", "sub", "sup", "font", "center",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    "*": ["style", "align", "colspan", "rowspan", "border", "cellpadding", "cellspacing", "bgcolor"],
    font: ["color", "size", "face"],
  },
  // javascript: や vbscript: を排除。cid: は解決できないので後段で置換する
  allowedSchemes: ["http", "https", "mailto", "tel", "data", "cid"],
  allowedSchemesByTag: { img: ["http", "https", "data", "cid"] },
  allowProtocolRelative: false,
  allowedStyles: {
    "*": {
      color: [/^.*$/],
      "background-color": [/^.*$/],
      "text-align": [/^.*$/],
      "font-size": [/^.*$/],
      "font-weight": [/^.*$/],
      "font-style": [/^.*$/],
      "text-decoration": [/^.*$/],
      margin: [/^.*$/],
      padding: [/^.*$/],
      border: [/^.*$/],
      "border-left": [/^.*$/],
      width: [/^.*$/],
      "max-width": [/^.*$/],
    },
  },
  transformTags: {
    // 外部リンクは新しいタブで開き、リファラを渡さない
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer nofollow" },
    }),
    img: (tagName, attribs) => {
      // cid: はメール内の埋め込み画像。表示できないのでプレースホルダーにする
      if ((attribs.src || "").toLowerCase().startsWith("cid:")) {
        return {
          tagName: "span",
          attribs: { style: "color:#8892a3;font-size:12px" },
          text: `［埋め込み画像${attribs.alt ? `: ${attribs.alt}` : ""}］`,
        };
      }
      return { tagName, attribs };
    },
  },
};

export function sanitizeEmailHtml(html: string): string {
  return sanitizeHtml(html, SANITIZE_OPTIONS);
}

export function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 素の URL をリンクにする
  const linked = escaped.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer nofollow">$1</a>'
  );

  return `<div style="white-space:pre-wrap">${linked}</div>`;
}

/* ────────────────────────────────────────────────────────────────
 * 引用部分の切り離し
 * ──────────────────────────────────────────────────────────────── */

/** HTML 本文を「今回書かれた部分」と「引用された履歴」に分ける */
export function splitQuotedHtml(html: string): { main: string; quoted: string | null } {
  const markers = [
    /<div[^>]*class="[^"]*gmail_quote[^"]*"/i,
    /<blockquote[^>]*class="[^"]*gmail_quote[^"]*"/i,
    /<div[^>]*id="appendonsend"/i,
    /<div[^>]*id="divRplyFwdMsg"/i,
    /<hr[^>]*id="stopSpelling"/i,
    /<div[^>]*class="[^"]*yahoo_quoted[^"]*"/i,
    /<div[^>]*class="[^"]*moz-cite-prefix[^"]*"/i,
  ];

  let cutAt = -1;
  for (const marker of markers) {
    const m = html.match(marker);
    if (m?.index !== undefined && (cutAt === -1 || m.index < cutAt)) {
      cutAt = m.index;
    }
  }

  if (cutAt <= 0) return { main: html, quoted: null };

  const main = html.slice(0, cutAt);
  const quoted = html.slice(cutAt);

  // 切った結果が空同然なら分割しない（引用だけのメール等）
  if (sanitizeHtml(main, { allowedTags: [] }).trim().length === 0) {
    return { main: html, quoted: null };
  }

  return { main, quoted };
}

/** プレーンテキスト本文を同様に分割する */
export function splitQuotedText(text: string): { main: string; quoted: string | null } {
  const lines = text.split(/\r?\n/);

  const quoteStart = [
    // 日本語クライアント
    /^\d{4}年\d{1,2}月\d{1,2}日.*[:：]\s*$/,
    /^-{2,}\s*(元のメッセージ|オリジナルメッセージ|転送メッセージ)\s*-{2,}/,
    // 英語クライアント
    /^On .+ wrote:\s*$/,
    /^-{2,}\s*Original Message\s*-{2,}/i,
    /^-{2,}\s*Forwarded message\s*-{2,}/i,
    /^_{10,}\s*$/,
    /^From:\s*.+<.+@.+>/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isQuoteHeader = quoteStart.some((re) => re.test(line));
    // 引用記号 > が続く塊の始まり
    const isQuoteBlock = line.startsWith(">") && i > 0;

    if ((isQuoteHeader || isQuoteBlock) && i > 0) {
      const main = lines.slice(0, i).join("\n").trimEnd();
      if (main.trim().length === 0) break;
      return { main, quoted: lines.slice(i).join("\n") };
    }
  }

  return { main: text, quoted: null };
}
