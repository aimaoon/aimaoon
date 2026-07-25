/**
 * デモデータを入れ直します。
 *
 *   npm run seed:demo            サンプル会話を作成（既存のデモデータは作り直し）
 *   npm run seed:demo -- --reset デモデータだけ削除
 *
 * 実際に Gmail から取り込んだメールには触れません。
 */
import { seedDemoData, resetDemoData } from "../src/lib/demo-seed.ts";
import { prisma } from "../src/lib/prisma.ts";

async function main() {
  if (process.argv.includes("--reset")) {
    const removed = await resetDemoData();
    console.log(`デモチケット ${removed} 件を削除しました。`);
    return;
  }

  const { tickets } = await seedDemoData();
  console.log(`デモデータを投入しました（チケット ${tickets} 件）。`);
  console.log("「請求書の再発行をお願いします」には次の3種類の返信が含まれます:");
  console.log("  - このアプリから送信（送信者が確実に記録されている）");
  console.log("  - 齊藤さんの委任送信（Sender ヘッダーから自動判別）");
  console.log("  - Gmail から直接送信（送信者不明 → 手動で設定できる）");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
