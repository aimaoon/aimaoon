import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "./env";

const COOKIE_NAME = "mt_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30日

export type SessionPayload = {
  accountId: string;
  email: string;
};

function secretKey() {
  return new TextEncoder().encode(env.sessionSecret);
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey());

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https://"),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.accountId !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return { accountId: payload.accountId, email: payload.email };
  } catch {
    // 期限切れ・改ざん・SESSION_SECRET 変更 → 未ログイン扱い
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** CSRF 対策の state 用に短命な cookie を使う */
export async function setOAuthState(state: string): Promise<void> {
  const store = await cookies();
  store.set("mt_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.appUrl.startsWith("https://"),
    path: "/",
    maxAge: 600,
  });
}

export async function consumeOAuthState(): Promise<string | null> {
  const store = await cookies();
  const value = store.get("mt_oauth_state")?.value ?? null;
  store.delete("mt_oauth_state");
  return value;
}
