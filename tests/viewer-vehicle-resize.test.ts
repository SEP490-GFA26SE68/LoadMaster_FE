import { describe, expect, test } from 'vitest'
import { RESIZE_MAX_RATIO, resizePose, resizeStart, visualBox } from '@/features/viewer3d/scene/vehicle-resize'

const box = (length: number, height: number, width: number) => ({ length, height, width })

describe('resizeStart', () => {
  test('starts the new box at the old size: old / new per axis (x length, y height, z width)', () => {
    expect(resizeStart(box(6, 2.4, 2.35), box(9, 2.4, 2.35))).toEqual([6 / 9, 1, 1])
    expect(resizeStart(box(9, 2, 2), box(3, 2.5, 2.4))).toEqual([3, 2 / 2.5, 2 / 2.4])
  })

  test('same size, or a change under half a centimetre on every axis, jumps', () => {
    expect(resizeStart(box(6, 2.4, 2.35), box(6, 2.4, 2.35))).toBeNull()
    expect(resizeStart(box(6, 2.4, 2.35), box(6.004, 2.4, 2.35))).toBeNull()
    expect(resizeStart(box(6, 2.4, 2.35), box(6.006, 2.4, 2.35))).not.toBeNull()
  })

  test('a change larger than the ratio cap jumps (a half-typed number in the vehicle form)', () => {
    expect(resizeStart(box(0.5, 2, 2), box(0.5 * RESIZE_MAX_RATIO, 2, 2))).not.toBeNull()
    expect(resizeStart(box(0.5, 2, 2), box(0.5 * RESIZE_MAX_RATIO + 0.01, 2, 2))).toBeNull()
    expect(resizeStart(box(9, 2, 2), box(9 / RESIZE_MAX_RATIO - 0.01, 2, 2))).toBeNull()
  })

  test('no previous box or an unusable size jumps', () => {
    expect(resizeStart(null, box(6, 2, 2))).toBeNull()
    expect(resizeStart(box(0, 2, 2), box(6, 2, 2))).toBeNull()
    expect(resizeStart(box(6, 2, 2), box(Number.NaN, 2, 2))).toBeNull()
  })
})

describe('resizePose', () => {
  const to = box(9, 2.4, 2.35)
  const start: [number, number, number] = [6 / 9, 1, 2 / 2.35]

  test('t = 0 shows the old box, centred on the origin of the scene', () => {
    const pose = resizePose(start, to, 0)
    expect(pose.scale).toEqual(start)
    expect(pose.offset[0]).toBeCloseTo(-3)
    expect(pose.offset[1]).toBeCloseTo(-1.2)
    expect(pose.offset[2]).toBeCloseTo(-1)
  })

  test('t = 1 is exactly the new box: scale 1, offset minus the centre of the new box', () => {
    expect(resizePose(start, to, 1)).toEqual({ scale: [1, 1, 1], offset: [-4.5, -1.2, -1.175] })
  })

  test('in between, the visible box grows linearly in t and stays centred', () => {
    const pose = resizePose(start, to, 0.5)
    expect(pose.scale[0]).toBeCloseTo((6 / 9 + 1) / 2)
    const visible = visualBox(to, pose.scale)
    expect(visible.length).toBeCloseTo(7.5)
    expect(visible.width).toBeCloseTo(2.175)
    expect(pose.offset[0]).toBeCloseTo(-visible.length / 2)
  })

  test('an interrupted resize restarts from the box on screen', () => {
    const mid = visualBox(to, resizePose(start, to, 0.5).scale)
    const next = box(3, 2.4, 2.35)
    const restart = resizeStart(mid, next)!
    expect(restart[0]).toBeCloseTo(7.5 / 3)
    expect(resizePose(restart, next, 0).offset[0]).toBeCloseTo(-3.75)
  })
})
