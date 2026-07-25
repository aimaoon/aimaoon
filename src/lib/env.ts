function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `環境変数 ${name} が設定されていません。.env.example を .env にコピーして値を入れてください。`
    );
  }
  return value;
}

export const env = {
  get googleClientId() {
    return required("GOOGLE_CLIENT_ID");
  },
  get googleClientSecret() {
    return required("GOOGLE_CLIENT_SECRET");
  },
  get appUrl() {
    return process.env.APP_URL || "http://localhost:3000";
  },
  get sessionSecret() {
    const secret = required("SESSION_SECRET");
    if (secret.length < 32) {
      throw new Error(
        "SESSION_SECRET が短すぎます。32文字以上のランダムな文字列を設定してください。"
      );
    }
    return secret;
  },
  get redirectUri() {
    return `${this.appUrl}/api/auth/callback`;
  },
  get syncDaysBack() {
    const n = Number(process.env.SYNC_DAYS_BACK ?? 180);
    return Number.isFinite(n) && n >= 0 ? n : 180;
  },
  get syncMaxMessages() {
    const n = Number(process.env.SYNC_MAX_MESSAGES ?? 2000);
    return Number.isFinite(n) && n > 0 ? n : 2000;
  },
};

/** 設定が一通り揃っているか（設定漏れ画面の出し分けに使う） */
export function checkConfig(): { ok: boolean; missing: string[] } {
  const missing: string[] = [];
  for (const key of ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "SESSION_SECRET"]) {
    if (!process.env[key]) missing.push(key);
  }
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length < 32) {
    missing.push("SESSION_SECRET（32文字以上にしてください）");
  }
  return { ok: missing.length === 0, missing };
}
