export function DemoBanner() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-amber-300 bg-amber-100 px-4 py-1.5 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100">
      <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        デモ
      </span>
      <span>
        サンプルデータを表示しています。<strong>Gmail には接続していません</strong>
        — 同期は行われず、返信も実際には送信されません（記録だけ残ります）。
      </span>
      <span className="text-amber-800 dark:text-amber-300">
        本番で使うには README の「セットアップ手順」で Google 連携を設定してください。
      </span>
    </div>
  );
}
