import { describe, expect, test } from 'vitest'
import { clockSpeedFrom, createSimClock, MAX_CLOCK_SPEED } from './clock'

/** Đồng hồ máy giả: test tự đẩy giờ. */
function wallClock(start: string) {
  let ms = Date.parse(start)
  return { now: () => new Date(ms), advance: (byMs: number) => { ms += byMs }, set: (iso: string) => { ms = Date.parse(iso) } }
}

describe('clock speed from the URL (?toc-do=<n>)', () => {
  test('no parameter: real time', () => {
    expect(clockSpeedFrom('')).toBe(1)
    expect(clockSpeedFrom('?lang=en')).toBe(1)
  })

  test('n times faster', () => {
    expect(clockSpeedFrom('?toc-do=60')).toBe(60)
    expect(clockSpeedFrom('?lang=en&toc-do=2.5')).toBe(2.5)
  })

  test('anything that is not a speed-up is real time; the speed is capped', () => {
    for (const search of ['?toc-do=', '?toc-do=nhanh', '?toc-do=0', '?toc-do=-5', '?toc-do=0.5', '?toc-do=Infinity', '?toc-do=NaN']) {
      expect(clockSpeedFrom(search), search).toBe(1)
    }
    expect(MAX_CLOCK_SPEED).toBe(3600)
    expect(clockSpeedFrom('?toc-do=100000')).toBe(3600)
  })
})

describe('simulated clock', () => {
  test('at speed 1 it is the wall clock itself, whatever the wall clock does', () => {
    const wall = wallClock('2026-09-14T05:00:00.000Z')
    const clock = createSimClock(wall.now)
    expect(clock.speed()).toBe(1)
    expect(clock.now().toISOString()).toBe('2026-09-14T05:00:00.000Z')
    wall.advance(90_000)
    expect(clock.now().toISOString()).toBe('2026-09-14T05:01:30.000Z')
    // test giả `Date` sau khi kho đã tạo: đồng hồ kho đi theo, không giữ mốc cũ
    wall.set('2026-09-01T00:00:00.000Z')
    expect(clock.now().toISOString()).toBe('2026-09-01T00:00:00.000Z')
  })

  test('at speed n it starts at the wall time and then runs n times faster', () => {
    const wall = wallClock('2026-09-14T05:00:00.000Z')
    const clock = createSimClock(wall.now, 60)
    expect(clock.speed()).toBe(60)
    expect(clock.now().toISOString()).toBe('2026-09-14T05:00:00.000Z')
    wall.advance(1_000)
    expect(clock.now().toISOString()).toBe('2026-09-14T05:01:00.000Z')
    wall.advance(59_000)
    expect(clock.now().toISOString()).toBe('2026-09-14T06:00:00.000Z')
  })

  test('changing the speed never makes the time jump: it goes on from where it is at the new pace', () => {
    const wall = wallClock('2026-09-14T05:00:00.000Z')
    const clock = createSimClock(wall.now, 60)
    wall.advance(60_000)
    expect(clock.now().toISOString()).toBe('2026-09-14T06:00:00.000Z')
    clock.setSpeed(1)
    expect(clock.speed()).toBe(1)
    expect(clock.now().toISOString()).toBe('2026-09-14T06:00:00.000Z')
    wall.advance(60_000)
    expect(clock.now().toISOString()).toBe('2026-09-14T06:01:00.000Z')
    clock.setSpeed(120)
    wall.advance(500)
    expect(clock.now().toISOString()).toBe('2026-09-14T06:02:00.000Z')
  })

  test('a fractional speed keeps whole milliseconds', () => {
    const wall = wallClock('2026-09-14T05:00:00.000Z')
    const clock = createSimClock(wall.now, 2.5)
    wall.advance(3)
    expect(clock.now().toISOString()).toBe('2026-09-14T05:00:00.008Z')
  })
})
