import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { buildAuthUrl } from "@/lib/google";
import { setOAuthState } from "@/lib/session";
import { checkConfig } from "@/lib/env";

export async function GET() {
  const config = checkConfig();
  if (!config.ok) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          `設定が不足しています: ${config.missing.join(", ")}`
        )}`,
        process.env.APP_URL || "http://localhost:3000"
      )
    );
  }

  const state = randomBytes(16).toString("hex");
  await setOAuthState(state);

  return NextResponse.redirect(buildAuthUrl(state));
}
