import { NextRequest } from "next/server";
import { ApiError, handle, requireSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isSyncing, startSync } from "@/lib/sync";
import { isDemoAccount } from "@/lib/demo";

export const dynamic = "force-dynamic";

/** 同期の進捗を返す（画面からポーリングする） */
export async function GET() {
  return handle(async () => {
    const session = await requireSession();
    const state = await prisma.syncState.findUnique({
      where: { accountId: session.accountId },
    });

    return {
      running: state?.running ?? isSyncing(session.accountId),
      initialDone: state?.initialDone ?? false,
      importedCount: state?.importedCount ?? 0,
      progressNote: state?.progressNote ?? null,
      lastSyncedAt: state?.lastSyncedAt ?? null,
      lastError: state?.lastError ?? null,
    };
  });
}

/** 同期を開始する。?full=1 で全件やり直し */
export async function POST(request: NextRequest) {
  return handle(async () => {
    const session = await requireSession();

    if (await isDemoAccount(session.accountId)) {
      throw new ApiError(
        "デモモードでは Gmail と同期できません。README の手順で Google 連携を設定してください。"
      );
    }

    const full = request.nextUrl.searchParams.get("full") === "1";

    const started = startSync(session.accountId, { full });
    return {
      started,
      message: started ? "同期を開始しました。" : "すでに同期が実行中です。",
    };
  });
}
