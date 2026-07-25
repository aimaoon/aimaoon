import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./session";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 400
  ) {
    super(message);
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new ApiError("ログインが必要です。", 401);
  return session;
}

/** ルートハンドラの例外を JSON エラーに変換する */
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse> {
  try {
    const data = await fn();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status });
    }
    console.error("API エラー", e);
    return NextResponse.json(
      { ok: false, error: (e as Error).message || "予期しないエラーが発生しました。" },
      { status: 500 }
    );
  }
}

export function requireString(
  value: unknown,
  field: string,
  { maxLength = 10000, allowEmpty = false }: { maxLength?: number; allowEmpty?: boolean } = {}
): string {
  if (typeof value !== "string") throw new ApiError(`${field} は文字列で指定してください。`);
  const trimmed = value.trim();
  if (!allowEmpty && trimmed.length === 0) throw new ApiError(`${field} を入力してください。`);
  if (trimmed.length > maxLength) {
    throw new ApiError(`${field} が長すぎます（${maxLength} 文字以内）。`);
  }
  return trimmed;
}

export function requireEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string
): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new ApiError(`${field} の値が不正です。`);
  }
  return value as T;
}

export function parseTicketId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError("チケット番号が不正です。", 404);
  return id;
}

export const TICKET_STATUSES = ["OPEN", "PENDING", "SOLVED", "CLOSED"] as const;
export const TICKET_PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
