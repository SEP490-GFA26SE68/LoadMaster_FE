import { describe, expect, test } from 'vitest'
import { clampPosition, fitPlacement, nudgePosition, placementOf, positionOf, snapPosition } from './panel-position'

// Khung nhìn 1.366 × 768, thanh điều hướng 60 px + khe 8 px; khung 380 × 400
const viewport = { width: 1366, height: 768 }
const bounds = { viewport, topInset: 68 }
const size = { width: 380, height: 400 }

describe('clampPosition', () => {
  test('keeps the panel inside the viewport and below the top inset', () => {
    expect(clampPosition({ left: -100, top: 0 }, size, bounds)).toEqual({ left: 8, top: 68 })
    expect(clampPosition({ left: 2000, top: 900 }, size, bounds)).toEqual({ left: 978, top: 360 })
    expect(clampPosition({ left: 500, top: 200 }, size, bounds)).toEqual({ left: 500, top: 200 })
  })

  test('a panel larger than the room sticks to the left and top so its header stays visible', () => {
    expect(clampPosition({ left: 300, top: 300 }, { width: 2000, height: 1000 }, bounds)).toEqual({ left: 8, top: 68 })
  })
})

describe('snapPosition', () => {
  test('snaps to the 24 px gutter of an edge within 24 px', () => {
    expect(snapPosition({ left: 20, top: 200 }, size, bounds)).toEqual({ left: 24, top: 200 })
    expect(snapPosition({ left: 970, top: 200 }, size, bounds)).toEqual({ left: 962, top: 200 })
    expect(snapPosition({ left: 500, top: 350 }, size, bounds)).toEqual({ left: 500, top: 344 })
  })

  test('snaps to the top inset within 24 px of it', () => {
    expect(snapPosition({ left: 500, top: 90 }, size, bounds)).toEqual({ left: 500, top: 68 })
  })

  test('leaves a drop away from the edges where it is', () => {
    expect(snapPosition({ left: 500, top: 200 }, size, bounds)).toEqual({ left: 500, top: 200 })
  })

  test('clamps before snapping a drop dragged past an edge', () => {
    expect(snapPosition({ left: -300, top: 2000 }, size, bounds)).toEqual({ left: 24, top: 344 })
  })
})

describe('placement', () => {
  test('anchors each axis to the nearest edge', () => {
    expect(placementOf({ left: 962, top: 344 }, size, viewport)).toEqual({ x: 'right', dx: 24, y: 'bottom', dy: 24 })
    expect(placementOf({ left: 24, top: 68 }, size, viewport)).toEqual({ x: 'left', dx: 24, y: 'top', dy: 68 })
  })

  test('round-trips through positionOf', () => {
    for (const point of [{ left: 962, top: 344 }, { left: 24, top: 68 }, { left: 300, top: 250 }]) {
      expect(positionOf(placementOf(point, size, viewport), size, viewport)).toEqual(point)
    }
  })

  test('keeps the anchored corner when the window shrinks', () => {
    const corner = { x: 'right', dx: 24, y: 'bottom', dy: 24 } as const
    expect(fitPlacement(corner, size, { viewport: { width: 800, height: 600 }, topInset: 68 })).toEqual(corner)
  })

  test('pulls a placement back inside a smaller window', () => {
    const far = { x: 'left', dx: 900, y: 'top', dy: 300 } as const
    expect(fitPlacement(far, size, { viewport: { width: 800, height: 600 }, topInset: 68 })).toEqual({ x: 'left', dx: 412, y: 'top', dy: 192 })
  })
})

describe('nudgePosition', () => {
  test('moves by the given step and stays inside the viewport, without snapping', () => {
    expect(nudgePosition({ left: 962, top: 344 }, size, bounds, { left: -16, top: 0 })).toEqual({ left: 946, top: 344 })
    expect(nudgePosition({ left: 962, top: 344 }, size, bounds, { left: 64, top: 0 })).toEqual({ left: 978, top: 344 })
    expect(nudgePosition({ left: 500, top: 80 }, size, bounds, { left: 0, top: -16 })).toEqual({ left: 500, top: 68 })
  })
})
