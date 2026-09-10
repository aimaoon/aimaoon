# marketing — 広告素材の作り方

Instagram の画像、A6 のフライヤー、紹介ページを、アプリの実画面から組み立てます。
出来上がりは `marketing/out/`（git には入れていません）。

## 作り直す

URL を変えたときや、画面を直したときは、これだけ。

```bash
npm install
npm i -D playwright        # 描画に使う。素材を作るときだけ入れる
node marketing/build.mjs   # 撮影 → フォント取得 → QR → 組版 → 書き出し
node marketing/verify.mjs  # QR がちゃんと読めるかを確かめる
node marketing/video.mjs   # 動画（別途 ffmpeg が要る）
```

`marketing/config.mjs` の `APP_URL` が QR とリンクの元になります。**配信先の URL を変えたら
必ずここを直してから作り直してください**（古い QR を刷ってしまうと取り返しがつきません）。

## 出来上がるもの

| ファイル | 用途 |
| --- | --- |
| `out/ig-1-hook.png` 〜 `ig-3-open.png` | Instagram フィード（1080×1080）。この順でカルーセルに |
| `out/ig-story.png` | Instagram ストーリー（1080×1920）。上下は UI を避けた余白 |
| `out/flyer-a6.pdf` | 印刷用フライヤー（105×148mm）。`flyer-preview.png` は確認用 |
| `out/landing.html` | 紹介ページ。そのまま公開できる 1 枚の HTML |
| `out/app-scroll-9x16.mp4` | 実際に触っているところの動画（1080×1920・約 19 秒）。リール / ストーリー用 |
| `out/app-scroll-4x5.mp4` | 同じ内容のフィード用（1080×1350） |

## 中でやっていること

1. **撮影** — `npx vite build` した中身を 1 枚の HTML にまとめ、iPhone 相当の画面で開いて撮ります。
   サンプルデータは起動時刻を基準にした相対日付なので、いつ作り直しても「これからの大会」が並びます。
2. **フォント** — 誌面に出る文字だけの Noto Sans JP を取ってきて data URI で埋め込みます。
   外部から font を読ませないので、相手の環境で崩れません。欧文の Anton は `src/assets` のものを使います。
3. **QR** — `qrcode`（devDependency）で組み立てます。アプリ本体の QR は `src/lib/qr.ts` の自前実装ですが、
   こちらは素材を作るときだけの道具なので、参照実装をそのまま使っています。
4. **確認** — 書き出した画像の QR を読み取り機（`jsQR`）にかけ、元の URL に戻ることを確かめます。
5. **動画** — 画面を操作しながら 1 コマずつ撮って、`ffmpeg` でつなぎます（`video.mjs`）。
   Playwright の録画機能は画面の下のほうを取りこぼす（タブバーが写らない）ので使っていません。
   撮る窓はアプリの最大幅 520px 以内。ここを超えると左右に余白が出ます。
   3 倍で撮って書き出しで縮めているので、文字の輪郭が締まります。
   `ffmpeg` は同梱していないので、無ければ `apt-get install ffmpeg` などで入れてください。
