import { prisma } from "./prisma";

/**
 * 共有アドレスから送られた返信の「実際の送信者」を特定する。
 *
 * 共有 Gmail では From が全員同じになるため、以下の手がかりを優先順に使う:
 *   1. APP             … このアプリから送った（送信時に記録済み。最も確実）
 *   2. DELEGATE_HEADER … Gmail の委任送信は Sender ヘッダーに本人のアドレスが入る
 *   3. FROM_NAME       … 送信者名を出し分けている場合（例: "サポート 山田 <support@…>"）
 *   4. SIGNATURE_RULE  … 本文の署名に含まれる文字列で判定
 *   5. UNKNOWN         … 判別不能。UI 上で「送信者不明」と明示し、手動で直せる
 *
 * 手動で直すとルールが自動追加され、次回以降は自動で判別されるようになる。
 */

export const ATTRIBUTION_METHODS = {
  APP: "APP",
  DELEGATE_HEADER: "DELEGATE_HEADER",
  FROM_NAME: "FROM_NAME",
  SIGNATURE_RULE: "SIGNATURE_RULE",
  MANUAL: "MANUAL",
  UNKNOWN: "UNKNOWN",
} as const;

export const RULE_KINDS = {
  DELEGATE_EMAIL: "DELEGATE_EMAIL",
  FROM_NAME: "FROM_NAME",
  SIGNATURE_CONTAINS: "SIGNATURE_CONTAINS",
} as const;

/** 判別方法を日本語で説明する（UI のツールチップ用） */
export const METHOD_LABELS: Record<string, { label: string; detail: string }> = {
  APP: {
    label: "このアプリから送信",
    detail: "このアプリの返信フォームから送信されたため、送信者が確実に記録されています。",
  },
  DELEGATE_HEADER: {
    label: "委任送信から判別",
    detail:
      "Gmail の代理送信（委任）では Sender ヘッダーに実際の送信者のアドレスが入ります。そこから判別しました。",
  },
  FROM_NAME: {
    label: "送信者名から判別",
    detail: "From ヘッダーの表示名がルールに一致したため判別しました。",
  },
  SIGNATURE_RULE: {
    label: "署名から判別",
    detail: "本文の署名に登録済みのキーワードが含まれていたため判別しました。",
  },
  MANUAL: {
    label: "手動で設定",
    detail: "人が手動で送信者を指定しました。自動判別で上書きされません。",
  },
  UNKNOWN: {
    label: "送信者不明",
    detail:
      "Gmail から直接送信されたため、誰が送ったか自動では分かりませんでした。送信者を選ぶと、次回から同じパターンを自動判別します。",
  },
};

const KIND_PRECEDENCE: Record<string, number> = {
  DELEGATE_EMAIL: 10,
  FROM_NAME: 20,
  SIGNATURE_CONTAINS: 30,
};

export type AttributionRuleLite = {
  id: string;
  agentId: string;
  kind: string;
  pattern: string;
  priority: number;
};

export type AttributionContext = {
  rules: AttributionRuleLite[];
  /** 個人アドレス → agentId */
  agentsByEmail: Map<string, string>;
  /** ログイン本人の agentId */
  meAgentId: string | null;
  /** 自社側とみなすアドレス（共有アドレス・エイリアス） */
  ownAddresses: Set<string>;
};

export type AttributionInput = {
  fromEmail: string;
  fromName: string | null;
  senderEmail: string | null;
  bodyText: string | null;
};

export type AttributionResult = {
  agentId: string | null;
  method: string;
  /** どの値で一致したか（履歴に残す用） */
  evidence: string | null;
};

export async function loadAttributionContext(
  ownAddresses: Set<string>
): Promise<AttributionContext> {
  const [rules, agents] = await Promise.all([
    prisma.attributionRule.findMany({
      select: { id: true, agentId: true, kind: true, pattern: true, priority: true },
    }),
    prisma.agentIdentity.findMany({
      where: { active: true },
      select: { id: true, email: true, isMe: true },
    }),
  ]);

  rules.sort(
    (a, b) =>
      (KIND_PRECEDENCE[a.kind] ?? 99) - (KIND_PRECEDENCE[b.kind] ?? 99) ||
      a.priority - b.priority
  );

  const agentsByEmail = new Map<string, string>();
  let meAgentId: string | null = null;
  for (const agent of agents) {
    if (agent.email) agentsByEmail.set(agent.email.toLowerCase(), agent.id);
    if (agent.isMe) meAgentId = agent.id;
  }

  return { rules, agentsByEmail, meAgentId, ownAddresses };
}

/**
 * 送信メール 1 通の送信者を判別する。
 * DB は触らないので、同期ループ内から何度呼んでも安全。
 */
export function attributeOutbound(
  input: AttributionInput,
  ctx: AttributionContext
): AttributionResult {
  // ── 2. 委任送信（Sender ヘッダー）──────────────────────────────
  const sender = input.senderEmail?.toLowerCase() ?? null;
  if (sender && sender !== input.fromEmail.toLowerCase()) {
    const direct = ctx.agentsByEmail.get(sender);
    if (direct) {
      return {
        agentId: direct,
        method: ATTRIBUTION_METHODS.DELEGATE_HEADER,
        evidence: sender,
      };
    }
    const rule = ctx.rules.find(
      (r) => r.kind === RULE_KINDS.DELEGATE_EMAIL && r.pattern === sender
    );
    if (rule) {
      return {
        agentId: rule.agentId,
        method: ATTRIBUTION_METHODS.DELEGATE_HEADER,
        evidence: sender,
      };
    }
    // 未知の委任者。呼び出し側で担当者を自動作成できるよう evidence だけ返す
    return {
      agentId: null,
      method: ATTRIBUTION_METHODS.UNKNOWN,
      evidence: sender,
    };
  }

  // ── 3. 送信者名 ────────────────────────────────────────────────
  const fromName = input.fromName?.trim().toLowerCase() ?? "";
  if (fromName) {
    const rule = ctx.rules.find(
      (r) => r.kind === RULE_KINDS.FROM_NAME && fromName.includes(r.pattern)
    );
    if (rule) {
      return {
        agentId: rule.agentId,
        method: ATTRIBUTION_METHODS.FROM_NAME,
        evidence: input.fromName,
      };
    }
  }

  // ── 4. 署名 ────────────────────────────────────────────────────
  const body = input.bodyText?.toLowerCase() ?? "";
  if (body) {
    // 署名は末尾にあることが多いので、後半 1500 文字を優先して見る
    const tail = body.slice(-1500);
    const rule =
      ctx.rules.find(
        (r) => r.kind === RULE_KINDS.SIGNATURE_CONTAINS && tail.includes(r.pattern)
      ) ??
      ctx.rules.find(
        (r) => r.kind === RULE_KINDS.SIGNATURE_CONTAINS && body.includes(r.pattern)
      );
    if (rule) {
      return {
        agentId: rule.agentId,
        method: ATTRIBUTION_METHODS.SIGNATURE_RULE,
        evidence: rule.pattern,
      };
    }
  }

  return { agentId: null, method: ATTRIBUTION_METHODS.UNKNOWN, evidence: null };
}

/** 委任送信で見つかった未知のアドレスを担当者として自動登録する */
export async function ensureAgentForDelegate(email: string): Promise<string> {
  const normalized = email.toLowerCase();
  const existing = await prisma.agentIdentity.findUnique({
    where: { email: normalized },
  });
  if (existing) return existing.id;

  const localPart = normalized.split("@")[0].replace(/[._-]+/g, " ").trim();
  const created = await prisma.agentIdentity.create({
    data: {
      name: localPart || normalized,
      email: normalized,
      color: colorForString(normalized),
    },
  });
  await prisma.attributionRule.upsert({
    where: {
      kind_pattern: { kind: RULE_KINDS.DELEGATE_EMAIL, pattern: normalized },
    },
    create: {
      agentId: created.id,
      kind: RULE_KINDS.DELEGATE_EMAIL,
      pattern: normalized,
      source: "LEARNED",
      priority: 10,
    },
    update: {},
  });
  return created.id;
}

/**
 * 手動で送信者を指定したときに、同じパターンを次回から自動判別できるよう
 * ルールを学習する。作成できたルールの説明文を返す。
 */
export async function learnFromManualAssignment(
  agentId: string,
  message: { senderEmail: string | null; fromName: string | null; fromEmail: string }
): Promise<string | null> {
  const sender = message.senderEmail?.toLowerCase() ?? null;

  if (sender && sender !== message.fromEmail.toLowerCase()) {
    await prisma.attributionRule.upsert({
      where: {
        kind_pattern: { kind: RULE_KINDS.DELEGATE_EMAIL, pattern: sender },
      },
      create: {
        agentId,
        kind: RULE_KINDS.DELEGATE_EMAIL,
        pattern: sender,
        source: "LEARNED",
        priority: 10,
      },
      update: { agentId },
    });
    return `今後 ${sender} からの代理送信は自動でこの担当者になります`;
  }

  return null;
}

/** ルールを変更したあと、手動設定されていないメールを判別し直す */
export async function reattributeAll(ownAddresses: Set<string>): Promise<number> {
  const ctx = await loadAttributionContext(ownAddresses);

  const messages = await prisma.message.findMany({
    where: {
      direction: "OUTBOUND",
      attributionLocked: false,
      sentViaApp: false,
    },
    select: {
      id: true,
      fromEmail: true,
      fromName: true,
      senderEmail: true,
      bodyText: true,
      authorAgentId: true,
      attributionMethod: true,
    },
  });

  let updated = 0;
  for (const msg of messages) {
    const result = attributeOutbound(msg, ctx);
    if (
      result.agentId !== msg.authorAgentId ||
      result.method !== msg.attributionMethod
    ) {
      await prisma.message.update({
        where: { id: msg.id },
        data: {
          authorAgentId: result.agentId,
          attributionMethod: result.method,
        },
      });
      updated++;
    }
  }

  return updated;
}

/** 文字列から安定した識別色を作る（担当者アイコンの色分け用） */
export function colorForString(input: string): string {
  const palette = [
    "#2a56c4", "#0f8a6a", "#b4530a", "#8b2fa8",
    "#0d7490", "#a8323c", "#4c6b16", "#6b4bd6",
  ];
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return palette[hash % palette.length];
}

/**
 * 本文の末尾から署名らしい行を抜き出して、ルール候補として提示する。
 * 「この文字列を登録すれば次から自動判別できます」と UI で見せるために使う。
 */
export function suggestSignaturePatterns(bodyText: string | null): string[] {
  if (!bodyText) return [];

  const lines = bodyText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const tail = lines.slice(-12);
  const suggestions: string[] = [];

  for (const line of tail) {
    if (line.length < 2 || line.length > 40) continue;
    if (line.includes("@") || /^https?:/i.test(line)) continue;
    if (/^[-=_*~]{2,}$/.test(line)) continue;
    // 電話番号や住所らしい行は除く
    if (/^[\d\s()+-]{6,}$/.test(line)) continue;
    suggestions.push(line);
  }

  return [...new Set(suggestions)].slice(0, 6);
}
