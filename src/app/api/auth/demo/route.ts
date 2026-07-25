import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { createSession } from "@/lib/session";
import { ensureDemoAccount, isDemoModeEnabled } from "@/lib/demo";
import { hasDemoData, seedDemoData } from "@/lib/demo-seed";

/**
 * Google 連携なしでアプリを試すためのログイン。
 * .env に DEMO_MODE=1 が無い限り必ず拒否します。
 */
export async function GET() {
  if (!isDemoModeEnabled()) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          "デモモードは無効です。.env に DEMO_MODE=1 を追加してください。"
        )}`,
        env.appUrl
      )
    );
  }

  try {
    const account = await ensureDemoAccount();

    if (!(await hasDemoData())) {
      await seedDemoData();
    }

    await createSession({ accountId: account.id, email: account.email });
    return NextResponse.redirect(new URL("/tickets", env.appUrl));
  } catch (e) {
    console.error("デモモードの開始に失敗しました", e);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(
          `デモの準備に失敗しました: ${(e as Error).message}`
        )}`,
        env.appUrl
      )
    );
  }
}
