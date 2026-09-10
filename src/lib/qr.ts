/**
 * QR コードの組み立て（バイトモード・誤り訂正レベル M）。
 *
 * 会場は電波が悪いことがあるので、外から何かを読み込まずに描けるようにしている。
 * 規格（ISO/IEC 18004）の手順どおりで、出来上がりは参照実装と 1 マスずつ突き合わせて確かめている。
 */

/** 出来上がった QR。modules[y][x] が true なら黒。 */
export interface QrCode {
  /** 一辺のマス数 */
  size: number
  modules: boolean[][]
}

/** 版ごとの総コードワード数。 */
// prettier-ignore
const TOTAL_CODEWORDS = [
  26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
  404, 466, 532, 581, 655, 733, 815, 901, 991, 1085,
  1156, 1258, 1364, 1474, 1588, 1706, 1828, 1921, 2051, 2185,
  2323, 2465, 2611, 2761, 2876, 3034, 3196, 3362, 3532, 3706,
]

/** 版ごとの誤り訂正コードワード数（レベル M）。 */
// prettier-ignore
const EC_CODEWORDS = [
  10, 16, 26, 36, 48, 64, 72, 88, 110, 130,
  150, 176, 198, 216, 240, 280, 308, 338, 364, 416,
  442, 476, 504, 560, 588, 644, 700, 728, 784, 812,
  868, 924, 980, 1036, 1064, 1120, 1204, 1260, 1316, 1372,
]

/** 版ごとのブロック数（レベル M）。 */
// prettier-ignore
const EC_BLOCKS = [
  1, 1, 1, 2, 2, 4, 4, 4, 5, 5,
  5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
  17, 17, 18, 20, 21, 23, 25, 26, 28, 29,
  31, 33, 35, 37, 38, 40, 43, 45, 47, 49,
]

/** レベル M の識別子（形式情報に入れる 2 ビット）。 */
const EC_LEVEL_BITS = 0b00

const MAX_VERSION = 40

/* ------------------------------------------------------------------ *
 * ガロア体 GF(256)
 * ------------------------------------------------------------------ */

const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let value = 1
  for (let index = 0; index < 255; index += 1) {
    EXP[index] = value
    LOG[value] = index
    value <<= 1
    if (value & 0x100) value ^= 0x11d
  }
  for (let index = 255; index < 512; index += 1) EXP[index] = EXP[index - 255]
}

function mul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a] + LOG[b]]
}

/** 誤り訂正コードワードを count 個作るための生成多項式。 */
function generatorPoly(count: number): Uint8Array {
  let poly = new Uint8Array([1])
  for (let index = 0; index < count; index += 1) {
    const next = new Uint8Array(poly.length + 1)
    for (let position = 0; position < poly.length; position += 1) {
      next[position] ^= poly[position]
      next[position + 1] ^= mul(poly[position], EXP[index])
    }
    poly = next
  }
  return poly
}

/** 1 ブロック分の誤り訂正コードワード。 */
function errorCorrection(data: Uint8Array, count: number): Uint8Array {
  const poly = generatorPoly(count)
  const remainder = new Uint8Array(count)
  for (const byte of data) {
    const factor = byte ^ remainder[0]
    remainder.copyWithin(0, 1)
    remainder[count - 1] = 0
    if (factor !== 0) {
      for (let index = 0; index < count; index += 1) {
        remainder[index] ^= mul(poly[index + 1], factor)
      }
    }
  }
  return remainder
}

/* ------------------------------------------------------------------ *
 * 版と並べ方
 * ------------------------------------------------------------------ */

/** 一辺のマス数。 */
function symbolSize(version: number): number {
  return version * 4 + 17
}

/** 文字数を表すのに使うビット数（バイトモード）。 */
function charCountBits(version: number): number {
  return version < 10 ? 8 : 16
}

/** その版に入れられるデータのコードワード数。 */
function dataCodewords(version: number): number {
  return TOTAL_CODEWORDS[version - 1] - EC_CODEWORDS[version - 1]
}

/** 収まる最小の版。長すぎれば null。 */
export function pickVersion(byteLength: number): number | null {
  for (let version = 1; version <= MAX_VERSION; version += 1) {
    const bits = 4 + charCountBits(version) + byteLength * 8
    if (bits <= dataCodewords(version) * 8) return version
  }
  return null
}

/** 位置合わせパターンの中心座標。 */
export function alignmentCoords(version: number): number[] {
  if (version === 1) return []
  const count = Math.floor(version / 7) + 2
  const size = symbolSize(version)
  // 版 32（一辺 145）だけは規格の値が式と合わないので、そこだけ合わせる。
  const step = size === 145 ? 26 : Math.ceil((size - 13) / (2 * count - 2)) * 2
  const positions = [size - 7]
  for (let index = 1; index < count - 1; index += 1) {
    positions.push(positions[index - 1] - step)
  }
  positions.push(6)
  return positions.reverse()
}

/* ------------------------------------------------------------------ *
 * ビット列 → コードワード
 * ------------------------------------------------------------------ */

function buildCodewords(bytes: Uint8Array, version: number): Uint8Array {
  const capacity = dataCodewords(version)
  const bits: number[] = []
  const push = (value: number, length: number) => {
    for (let index = length - 1; index >= 0; index -= 1) bits.push((value >> index) & 1)
  }

  push(0b0100, 4) // バイトモード
  push(bytes.length, charCountBits(version))
  for (const byte of bytes) push(byte, 8)

  // 終端の 0 は、容量に余りがあるぶんだけ（最大 4 つ）。
  const remaining = capacity * 8 - bits.length
  push(0, Math.min(4, remaining))
  while (bits.length % 8 !== 0) bits.push(0)

  const data = new Uint8Array(capacity)
  for (let index = 0; index < bits.length; index += 8) {
    let byte = 0
    for (let offset = 0; offset < 8; offset += 1) byte = (byte << 1) | bits[index + offset]
    data[index / 8] = byte
  }
  // 余りは 0xEC と 0x11 を交互に詰める。
  for (let index = bits.length / 8, turn = 0; index < capacity; index += 1, turn += 1) {
    data[index] = turn % 2 === 0 ? 0xec : 0x11
  }

  return interleave(data, version)
}

/** ブロックに分けて誤り訂正を付け、規格の順に並べ直す。 */
function interleave(data: Uint8Array, version: number): Uint8Array {
  const blocks = EC_BLOCKS[version - 1]
  const ecPerBlock = EC_CODEWORDS[version - 1] / blocks
  const total = data.length
  const shortLength = Math.floor(total / blocks)
  const longBlocks = total % blocks

  const dataBlocks: Uint8Array[] = []
  const ecBlocks: Uint8Array[] = []
  let offset = 0
  for (let index = 0; index < blocks; index += 1) {
    const length = shortLength + (index >= blocks - longBlocks ? 1 : 0)
    const block = data.subarray(offset, offset + length)
    offset += length
    dataBlocks.push(block)
    ecBlocks.push(errorCorrection(block, ecPerBlock))
  }

  const out = new Uint8Array(TOTAL_CODEWORDS[version - 1])
  let cursor = 0
  for (let index = 0; index < shortLength + 1; index += 1) {
    for (const block of dataBlocks) {
      if (index < block.length) out[cursor++] = block[index]
    }
  }
  for (let index = 0; index < ecPerBlock; index += 1) {
    for (const block of ecBlocks) out[cursor++] = block[index]
  }
  return out
}

/* ------------------------------------------------------------------ *
 * マスへの配置
 * ------------------------------------------------------------------ */

type Grid = { size: number; modules: Int8Array; reserved: Uint8Array }

function grid(size: number): Grid {
  return { size, modules: new Int8Array(size * size), reserved: new Uint8Array(size * size) }
}

function set(g: Grid, x: number, y: number, dark: boolean, reserve = true): void {
  g.modules[y * g.size + x] = dark ? 1 : 0
  if (reserve) g.reserved[y * g.size + x] = 1
}

function isDark(g: Grid, x: number, y: number): boolean {
  return g.modules[y * g.size + x] === 1
}

function placeFinder(g: Grid, left: number, top: number): void {
  for (let y = -1; y <= 7; y += 1) {
    for (let x = -1; x <= 7; x += 1) {
      const px = left + x
      const py = top + y
      if (px < 0 || py < 0 || px >= g.size || py >= g.size) continue
      const inRing = (x >= 0 && x <= 6 && (y === 0 || y === 6)) || (y >= 0 && y <= 6 && (x === 0 || x === 6))
      const inCore = x >= 2 && x <= 4 && y >= 2 && y <= 4
      set(g, px, py, inRing || inCore)
    }
  }
}

function placePatterns(g: Grid, version: number): void {
  const size = g.size
  placeFinder(g, 0, 0)
  placeFinder(g, size - 7, 0)
  placeFinder(g, 0, size - 7)

  // タイミングパターン
  for (let index = 8; index < size - 8; index += 1) {
    const dark = index % 2 === 0
    set(g, index, 6, dark)
    set(g, 6, index, dark)
  }

  // 位置合わせパターン（ファインダーと重なるところは置かない）
  const coords = alignmentCoords(version)
  for (const cy of coords) {
    for (const cx of coords) {
      const nearFinder =
        (cx === 6 && cy === 6) || (cx === 6 && cy === size - 7) || (cx === size - 7 && cy === 6)
      if (nearFinder) continue
      for (let y = -2; y <= 2; y += 1) {
        for (let x = -2; x <= 2; x += 1) {
          const edge = Math.max(Math.abs(x), Math.abs(y))
          set(g, cx + x, cy + y, edge !== 1)
        }
      }
    }
  }

  // 形式情報の場所を空けておく
  for (let index = 0; index < 9; index += 1) {
    if (index !== 6) set(g, index, 8, false)
    if (index !== 6) set(g, 8, index, false)
  }
  for (let index = 0; index < 8; index += 1) {
    set(g, size - 1 - index, 8, false)
    if (index < 7) set(g, 8, size - 1 - index, false)
  }
  // 常に黒のマス
  set(g, 8, size - 8, true)

  // 版情報の場所（版 7 以降）
  if (version >= 7) {
    for (let index = 0; index < 18; index += 1) {
      const a = Math.floor(index / 3)
      const b = (index % 3) + size - 11
      set(g, a, b, false)
      set(g, b, a, false)
    }
  }
}

/** データを右下からジグザグに並べる。 */
function placeData(g: Grid, codewords: Uint8Array): void {
  const size = g.size
  let bitIndex = 0
  let upward = true

  for (let right = size - 1; right >= 1; right -= 2) {
    // 6 列目は縦のタイミングパターン。ここに来たら 1 つ左へずらす（次の周も 1 つずれる）。
    if (right === 6) right = 5
    for (let step = 0; step < size; step += 1) {
      const y = upward ? size - 1 - step : step
      for (let offset = 0; offset < 2; offset += 1) {
        const x = right - offset
        if (g.reserved[y * size + x]) continue
        const byte = codewords[bitIndex >> 3]
        const bit = byte === undefined ? 0 : (byte >> (7 - (bitIndex & 7))) & 1
        g.modules[y * size + x] = bit
        bitIndex += 1
      }
    }
    upward = !upward
  }
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
]

function applyMask(g: Grid, mask: number): Grid {
  const out: Grid = { size: g.size, modules: Int8Array.from(g.modules), reserved: g.reserved }
  const test = MASKS[mask]
  for (let y = 0; y < g.size; y += 1) {
    for (let x = 0; x < g.size; x += 1) {
      if (g.reserved[y * g.size + x]) continue
      if (test(x, y)) out.modules[y * g.size + x] ^= 1
    }
  }
  return out
}

/** 規格の減点。小さいほど読みやすい。 */
export function maskPenalty(g: Grid): number {
  const size = g.size
  const dark = (x: number, y: number) => g.modules[y * size + x] === 1
  let score = 0

  // 規則 1：同じ色が 5 つ以上続く
  for (let line = 0; line < size; line += 1) {
    for (const horizontal of [true, false]) {
      let run = 1
      for (let index = 1; index < size; index += 1) {
        const current = horizontal ? dark(index, line) : dark(line, index)
        const previous = horizontal ? dark(index - 1, line) : dark(line, index - 1)
        if (current === previous) {
          run += 1
        } else {
          if (run >= 5) score += run - 2
          run = 1
        }
      }
      if (run >= 5) score += run - 2
    }
  }

  // 規則 2：2×2 の同色
  for (let y = 0; y < size - 1; y += 1) {
    for (let x = 0; x < size - 1; x += 1) {
      const first = dark(x, y)
      if (first === dark(x + 1, y) && first === dark(x, y + 1) && first === dark(x + 1, y + 1)) score += 3
    }
  }

  // 規則 3：ファインダーに似た並び
  const pattern = [true, false, true, true, true, false, true]
  const light4 = [false, false, false, false]
  const matches = (get: (index: number) => boolean, start: number, want: boolean[]): boolean =>
    want.every((value, offset) => get(start + offset) === value)
  for (let line = 0; line < size; line += 1) {
    for (const horizontal of [true, false]) {
      const get = (index: number) => (horizontal ? dark(index, line) : dark(line, index))
      for (let start = 0; start + 10 < size; start += 1) {
        if (matches(get, start, [...pattern, ...light4])) score += 40
        if (matches(get, start, [...light4, ...pattern])) score += 40
      }
    }
  }

  // 規則 4：黒の割合が 50% からどれだけ離れているか（5% 刻み）
  let darkCount = 0
  for (let index = 0; index < g.modules.length; index += 1) if (g.modules[index] === 1) darkCount += 1
  score += Math.abs(Math.ceil((darkCount * 100) / (size * size) / 5) - 10) * 10

  return score
}

/** BCH(15,5)。形式情報用。 */
function formatBits(mask: number): number {
  const data = (EC_LEVEL_BITS << 3) | mask
  let value = data << 10
  for (let index = 4; index >= 0; index -= 1) {
    if (value & (1 << (index + 10))) value ^= 0b10100110111 << index
  }
  return ((data << 10) | value) ^ 0b101010000010010
}

/** BCH(18,6)。版情報用（版 7 以降）。 */
function versionBits(version: number): number {
  let value = version << 12
  for (let index = 5; index >= 0; index -= 1) {
    if (value & (1 << (index + 12))) value ^= 0b1111100100101 << index
  }
  return (version << 12) | value
}

function placeFormat(g: Grid, mask: number): void {
  const size = g.size
  const bits = formatBits(mask)
  const bit = (index: number) => ((bits >> index) & 1) === 1

  // 左上：縦に 0〜5 → 角 → 横へ 8〜14
  for (let index = 0; index < 6; index += 1) set(g, 8, index, bit(index))
  set(g, 8, 7, bit(6))
  set(g, 8, 8, bit(7))
  set(g, 7, 8, bit(8))
  for (let index = 9; index < 15; index += 1) set(g, 14 - index, 8, bit(index))

  // 右上（横）と左下（縦）に同じものをもう一度
  for (let index = 0; index < 8; index += 1) set(g, size - 1 - index, 8, bit(index))
  for (let index = 8; index < 15; index += 1) set(g, 8, size - 15 + index, bit(index))

  set(g, 8, size - 8, true)
}

function placeVersion(g: Grid, version: number): void {
  if (version < 7) return
  const size = g.size
  const bits = versionBits(version)
  for (let index = 0; index < 18; index += 1) {
    const dark = ((bits >> index) & 1) === 1
    const a = Math.floor(index / 3)
    const b = (index % 3) + size - 11
    set(g, a, b, dark)
    set(g, b, a, dark)
  }
}

/**
 * 文字列を QR にする。長すぎて版 40 にも入らないときは null。
 */
export function encodeQr(text: string): QrCode | null {
  const bytes = new TextEncoder().encode(text)
  const version = pickVersion(bytes.length)
  if (version === null) return null

  const codewords = buildCodewords(bytes, version)
  const size = symbolSize(version)

  const base = grid(size)
  placePatterns(base, version)
  placeData(base, codewords)

  let best: Grid | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (let mask = 0; mask < 8; mask += 1) {
    const candidate = applyMask(base, mask)
    placeFormat(candidate, mask)
    placeVersion(candidate, version)
    const score = maskPenalty(candidate)
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }

  const chosen = best as Grid
  const modules: boolean[][] = []
  for (let y = 0; y < size; y += 1) {
    const row: boolean[] = []
    for (let x = 0; x < size; x += 1) row.push(isDark(chosen, x, y))
    modules.push(row)
  }
  return { size, modules }
}
