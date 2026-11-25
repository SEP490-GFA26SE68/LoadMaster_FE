import { describe, expect, test } from 'vitest'
import { thinkingDelayMs } from './assistant-pace'

describe('thinkingDelayMs', () => {
  test('câu ngắn, đáp ngắn: gần mức tối thiểu', () => {
    // 2000 + 10 × 12 + 6 × 40 = 2360
    expect(thinkingDelayMs(12, 40)).toBe(2360)
  })

  test('câu vừa: tăng theo cả câu hỏi và câu trả lời', () => {
    // 2000 + 10 × 30 + 6 × 150 = 3200
    expect(thinkingDelayMs(30, 150)).toBe(3200)
  })

  test('chạm đúng mức tối đa', () => {
    // 2000 + 10 × 100 + 6 × 500 = 6000
    expect(thinkingDelayMs(100, 500)).toBe(6000)
  })

  test('vượt mức tối đa thì chặn ở 6.000 ms', () => {
    expect(thinkingDelayMs(200, 600)).toBe(6000)
    expect(thinkingDelayMs(5_000, 50_000)).toBe(6000)
  })

  test('đầu vào 0 là đúng mức tối thiểu', () => {
    expect(thinkingDelayMs(0, 0)).toBe(2000)
  })

  test('đầu vào âm hay không phải số thì coi như 0', () => {
    expect(thinkingDelayMs(-50, -10)).toBe(2000)
    expect(thinkingDelayMs(-50, 100)).toBe(2600)
    expect(thinkingDelayMs(Number.NaN, Number.POSITIVE_INFINITY)).toBe(2000)
  })

  test('số ký tự lẻ thì làm tròn tới ms', () => {
    // 2000 + 10 × 1,25 + 6 × 0,5 = 2015,5 → 2016
    expect(thinkingDelayMs(1.25, 0.5)).toBe(2016)
  })
})
