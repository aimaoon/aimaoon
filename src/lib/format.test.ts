import { describe, expect, it } from 'vitest'
import { formatDistance, formatMinutes, proximityOf } from './format'

describe('formatMinutes', () => {
  it('1 時間未満は分だけ', () => {
    expect(formatMinutes(45)).toBe('45分')
  })

  it('1 時間ちょうどは分を出さない', () => {
    expect(formatMinutes(60)).toBe('1時間')
  })

  it('時間と分を組み合わせる', () => {
    expect(formatMinutes(95)).toBe('1時間35分')
  })

  it('負の値は 0 分扱い', () => {
    expect(formatMinutes(-5)).toBe('0分')
  })
})

describe('formatDistance', () => {
  it('1km 未満は m 表記', () => {
    expect(formatDistance(0.8)).toBe('800m')
  })

  it('1km 以上は小数第 1 位まで', () => {
    expect(formatDistance(12.34)).toBe('12.3km')
  })
})

describe('proximityOf', () => {
  it('制限時間に対する余裕度で段階が変わる', () => {
    expect(proximityOf(20, 60)).toBe('close')
    expect(proximityOf(40, 60)).toBe('moderate')
    expect(proximityOf(55, 60)).toBe('tight')
    expect(proximityOf(61, 60)).toBe('over')
  })
})
