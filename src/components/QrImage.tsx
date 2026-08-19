import { useMemo } from 'react'
import { encodeQr } from '../lib/qr'

/**
 * QR を SVG で描く。
 *
 * 画面の配色に関わらず、いつも白地に黒で描く。
 * 反転した QR は読み取り機によっては拾えないことがあるので、ここは端末の見た目に合わせない。
 */
export function QrImage({ text, label }: { text: string; label: string }) {
  const code = useMemo(() => encodeQr(text), [text])

  if (!code) {
    return <p className="hint hint--warn">内容が長すぎて QR にできませんでした。リンクを送ってください。</p>
  }

  // まわりの余白（クワイエットゾーン）は規格どおり 4 マス分。無いと読み取れないことがある。
  const quiet = 4
  const span = code.size + quiet * 2

  const path: string[] = []
  for (let y = 0; y < code.size; y += 1) {
    for (let x = 0; x < code.size; x += 1) {
      if (code.modules[y][x]) path.push(`M${x + quiet} ${y + quiet}h1v1h-1z`)
    }
  }

  return (
    <svg
      className="qr"
      viewBox={`0 0 ${span} ${span}`}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={span} height={span} fill="#ffffff" />
      <path d={path.join('')} fill="#000000" />
    </svg>
  )
}
