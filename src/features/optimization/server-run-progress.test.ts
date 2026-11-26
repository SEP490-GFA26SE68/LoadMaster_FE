import { describe, expect, test } from 'vitest'
import { createFormatter } from '@/lib/format'
import { createTranslator } from '@/lib/i18n'
import { computationTime } from './computation-time'
import { countFrame } from './count-up'
import { elapsedMsOf, jobProgressOf } from './job-progress-dto'
import { anchorClock, clockElapsed, formatClock, timeShare } from './run-clock'
import { serverRunSteps } from './server-run-steps'

describe('jobProgressOf', () => {
  test('đọc đủ các trường đã biết', () => {
    expect(jobProgressOf({
      stage: 'IMPROVING', algorithm: 'GA', layoutsTried: 42, totalPackages: 120, bestPlacedCount: 118, bestVolumePercent: '81.5', updatedAt: 'x',
    })).toStrictEqual({ stage: 'IMPROVING', algorithm: 'GA', layoutsTried: 42, totalPackages: 120, bestPlacedCount: 118, bestVolumePercent: 81.5 })
  })

  test('bỏ từng giá trị lạ, không đoán', () => {
    expect(jobProgressOf({
      stage: 'WARMING_UP', algorithm: 'QUANTUM', layoutsTried: -1, totalPackages: null, bestPlacedCount: 1.5, bestVolumePercent: 120,
    })).toBeNull()
    expect(jobProgressOf({ stage: 'WARMING_UP', layoutsTried: 3, totalPackages: 10, bestPlacedCount: 11 })).toStrictEqual({
      stage: null, algorithm: null, layoutsTried: 3, totalPackages: 10, bestPlacedCount: null, bestVolumePercent: null,
    })
  })

  test('máy chủ cũ không gửi progress, hoặc gửi null', () => {
    expect(jobProgressOf(undefined)).toBeNull()
    expect(jobProgressOf(null)).toBeNull()
    expect(elapsedMsOf(undefined)).toBeNull()
    expect(elapsedMsOf(-5)).toBeNull()
    expect(elapsedMsOf(1500)).toBe(1500)
  })
})

describe('serverRunSteps', () => {
  const states = (views: ReturnType<typeof serverRunSteps>) => views.map(({ step, state }) => `${step}:${state}`)

  test('chờ hàng đợi: chỉ hai bước, không bước nào máy chủ chưa chứng minh', () => {
    expect(states(serverRunSteps({ status: 'PENDING', stage: null, sawImproving: false }))).toEqual(['queue:current', 'compute:pending'])
  })

  test('đang chạy mà không có progress (máy chủ cũ): đang tính', () => {
    expect(states(serverRunSteps({ status: 'RUNNING', stage: null, sawImproving: false }))).toEqual(['queue:done', 'compute:current'])
  })

  test('bước cải thiện chỉ có khi máy chủ báo', () => {
    expect(states(serverRunSteps({ status: 'RUNNING', stage: 'BUILDING', sawImproving: false })))
      .toEqual(['queue:done', 'build:current', 'select:pending', 'save:pending'])
    expect(states(serverRunSteps({ status: 'RUNNING', stage: 'IMPROVING', sawImproving: false })))
      .toEqual(['queue:done', 'build:done', 'improve:current', 'select:pending', 'save:pending'])
    expect(states(serverRunSteps({ status: 'RUNNING', stage: 'SAVING', sawImproving: true })))
      .toEqual(['queue:done', 'build:done', 'improve:done', 'select:done', 'save:current'])
  })

  test('job đã xong hay hỏng thì không có bước', () => {
    expect(serverRunSteps({ status: 'COMPLETED', stage: 'SAVING', sawImproving: true })).toEqual([])
    expect(serverRunSteps({ status: 'FAILED', stage: null, sawImproving: false })).toEqual([])
  })
})

describe('đồng hồ của lần chạy', () => {
  test('neo theo elapsedMs của máy chủ, chạy tiếp ở trình duyệt, không lùi', () => {
    const first = anchorClock(null, 4000, 1000)
    expect(clockElapsed(first, 3000)).toBe(6000)
    const later = anchorClock(first, 5000, 3000)
    expect(later.baseMs).toBe(6000)
    expect(anchorClock(later, 9000, 3500).baseMs).toBe(9000)
  })

  test('không có elapsedMs thì đếm từ lúc hộp thoại thấy job chạy', () => {
    const start = anchorClock(null, null, 2000)
    expect(clockElapsed(start, 2000)).toBe(0)
    expect(anchorClock(start, null, 9000)).toBe(start)
    expect(clockElapsed(start, 7400)).toBe(5400)
  })

  test('mm:ss và thanh so với giới hạn thời gian', () => {
    expect(formatClock(0)).toBe('00:00')
    expect(formatClock(65_900)).toBe('01:05')
    expect(timeShare(30_000, 60)).toStrictEqual({ fraction: 0.5, over: false })
    expect(timeShare(90_000, 60)).toStrictEqual({ fraction: 1, over: true })
    expect(timeShare(1000, null)).toBeNull()
    expect(timeShare(1000, 0)).toBeNull()
  })
})

describe('countFrame', () => {
  test('đếm lên tới đúng số, không vượt', () => {
    expect(countFrame(0, 118, 0)).toBe(0)
    const mid = countFrame(0, 118, 0.5)
    expect(mid).toBeGreaterThan(0)
    expect(mid).toBeLessThan(118)
    expect(Number.isInteger(mid)).toBe(true)
    expect(countFrame(0, 118, 0.999)).toBeLessThanOrEqual(118)
    expect(countFrame(0, 118, 1)).toBe(118)
  })

  test('số lẻ một chữ số theo bước 0,1', () => {
    const value = countFrame(60, 81.5, 0.4, 0.1)
    expect(value).toBeGreaterThan(60)
    expect(value).toBeLessThan(81.5)
    expect(Math.abs(value * 10 - Math.round(value * 10))).toBeLessThan(1e-6)
    expect(countFrame(60, 81.5, 1, 0.1)).toBe(81.5)
  })
})

describe('computationTime', () => {
  const vi = { t: createTranslator('vi'), format: createFormatter('vi-VN') }
  const en = { t: createTranslator('en'), format: createFormatter('en-US') }

  test('từ 1.000 ms viết bằng giây, dưới đó bằng ms', () => {
    expect(computationTime(60_000, vi.t, vi.format)).toBe('60,0 giây')
    expect(computationTime(60_000, en.t, en.format)).toBe('60.0 s')
    expect(computationTime(1000, vi.t, vi.format)).toBe('1,0 giây')
    expect(computationTime(999, vi.t, vi.format)).toBe('999 ms')
    expect(computationTime(12, en.t, en.format)).toBe('12 ms')
  })
})
