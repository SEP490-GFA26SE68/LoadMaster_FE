import { describe, expect, test } from 'vitest'
import type { VehicleConfig } from '@/domain/models'
import { fitFrame } from '@/features/viewer3d/scene/frame-fit'
import type { Vec3 } from '@/features/viewer3d/scene/units'
import { doorOpening, specFramePoints, vehicleSpecMarks } from '@/features/viewer3d/scene/vehicle-spec-marks'

/** Hyundai HD210 của seed: thùng 720 × 235 × 240 cm, cửa 225 × 230 cm, trục ở -100 và 475 cm. */
function hd210(overrides: Partial<VehicleConfig> = {}): VehicleConfig {
  return {
    id: 'VEHICLE-002',
    name: 'Hyundai HD210',
    innerLengthCm: 720,
    innerWidthCm: 235,
    innerHeightCm: 240,
    maxPayloadKg: 9500,
    doorWidthCm: 225,
    doorHeightCm: 230,
    doorPosition: 'REAR',
    clearanceCm: 0,
    obstacles: [],
    axles: [
      { id: 'AX-2', name: 'Trục sau', positionXCm: 475, emptyLoadKg: 0, maxLoadKg: 0 },
      { id: 'AX-1', name: 'Trục trước', positionXCm: -100, emptyLoadKg: 0, maxLoadKg: 0 },
    ],
    ...overrides,
  }
}

const close = (actual: readonly number[], expected: readonly number[]) =>
  expected.forEach((value, index) => expect(actual[index]).toBeCloseTo(value, 6))

describe('doorOpening', () => {
  test('a door narrower and lower than the cargo space leaves two jambs and a header', () => {
    const door = doorOpening(hd210())
    close([door.width, door.height, door.jamb, door.header], [2.25, 2.3, 0.05, 0.1])
  })

  test('a door as large as the cargo space has no frame', () => {
    const door = doorOpening(hd210({ doorWidthCm: 235, doorHeightCm: 240 }))
    close([door.jamb, door.header], [0, 0])
  })
})

describe('vehicleSpecMarks', () => {
  const marks = vehicleSpecMarks(hd210())
  const segment = (from: Vec3) => marks.segments.find((s) => s.from.every((value, i) => Math.abs(value - from[i]!) < 1e-9))

  test('the three dimension lines span exactly the typed length, width and height', () => {
    // Đường nằm cách cạnh thùng 0,3 m: dài dọc cạnh nóc bên phải, rộng dọc cạnh nóc phía cửa, cao ở cạnh đứng trước-phải
    close(segment([0, 2.7, 2.35])!.to, [7.2, 2.7, 2.35])
    close(segment([7.2, 2.7, 0])!.to, [7.2, 2.7, 2.35])
    close(segment([0, 0, 2.65])!.to, [0, 2.4, 2.65])
  })

  test('the door outline is the typed width × height, centred on the rear wall at floor level', () => {
    const door = marks.segments.filter((s) => s.role === 'door')
    expect(door).toHaveLength(4)
    const points = door.flatMap((s) => [s.from, s.to])
    expect(new Set(points.map((p) => p[0]))).toEqual(new Set([7.2]))
    close([Math.min(...points.map((p) => p[2])), Math.max(...points.map((p) => p[2]))], [0.05, 2.3])
    close([Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[1]))], [0, 2.3])
    close(marks.anchors.door, [7.2, 1.15, 1.175])
  })

  test('axle marks sit at positionXCm from the front wall, in position order', () => {
    expect(marks.axles.map(({ id, positionXCm, tier }) => ({ id, positionXCm, tier }))).toStrictEqual([
      { id: 'AX-1', positionXCm: -100, tier: 0 },
      { id: 'AX-2', positionXCm: 475, tier: 0 },
    ])
    close(marks.axles.map((axle) => axle.anchor[0]), [-1, 4.75])
  })

  test('labels of a tandem alternate between two rows', () => {
    const tandem = vehicleSpecMarks(hd210({ axles: [-100, 475, 600, 725].map((positionXCm, index) => ({
      id: `AX-${index}`, name: '', positionXCm, emptyLoadKg: 0, maxLoadKg: 0,
    })) }))
    expect(tandem.axles.map((axle) => axle.tier)).toStrictEqual([0, 0, 1, 0])
  })

  test('a vehicle without declared axles has no axle marks', () => {
    const bare = vehicleSpecMarks(hd210({ axles: undefined }))
    expect(bare.axles).toStrictEqual([])
    expect(bare.segments.filter((s) => s.role === 'axle')).toStrictEqual([])
  })
})

describe('specFramePoints', () => {
  test('only the cargo space moves the camera frame: door, obstacles and axles do not', () => {
    const changed = hd210({
      doorWidthCm: 200,
      axles: undefined,
      obstacles: [{ id: 'OBS-1', type: 'WHEEL_ARCH', xCm: 420, yCm: 0, zCm: 0, lengthCm: 110, widthCm: 25, heightCm: 32, loadBearing: false }],
    })
    expect(specFramePoints(changed)).toStrictEqual(specFramePoints(hd210()))
    expect(specFramePoints(hd210({ innerLengthCm: 600 }))).not.toStrictEqual(specFramePoints(hd210()))
  })

  test('every line of the marks lies inside the framed points', () => {
    const points = specFramePoints(hd210())
    const marks = vehicleSpecMarks(hd210())
    for (const axis of [0, 1, 2] as const) {
      const low = Math.min(...points.map((p) => p[axis])), high = Math.max(...points.map((p) => p[axis]))
      for (const point of marks.segments.flatMap((s) => [s.from, s.to])) {
        expect(point[axis]).toBeGreaterThanOrEqual(low - 1e-9)
        expect(point[axis]).toBeLessThanOrEqual(high + 1e-9)
      }
    }
  })
})

describe('fitFrame', () => {
  const view = { tanHalfH: 1, tanHalfV: 0.5, margin: 1, minDistance: 0.1 }

  test('points symmetric about the origin keep the origin as target', () => {
    const fit = fitFrame([[2, 1, 0], [-2, 1, 0], [2, -1, 0], [-2, -1, 0]], [0, 0, 1], view)
    close(fit.target, [0, 0, 0])
    // Ngang: 2 / tan = 2; dọc: 1 / 0,5 = 2
    expect(fit.distance).toBeCloseTo(2, 6)
  })

  test('an off-centre shape is centred instead of leaving half the frame empty', () => {
    const fit = fitFrame([[0, 0, 0], [4, 0, 0]], [0, 0, 1], view)
    close(fit.target, [2, 0, 0])
    // Nhìn vào gốc toạ độ thì phải lùi tới 4; nhìn vào giữa hai điểm chỉ cần 2
    expect(fit.distance).toBeCloseTo(2, 6)
  })

  test('the margin leaves that share of the frame empty', () => {
    expect(fitFrame([[1, 0, 0], [-1, 0, 0]], [0, 0, 1], { ...view, margin: 1.5 }).distance).toBeCloseTo(1.5, 6)
  })

  test('the truck at the diagonal view: every point is inside the frame, and closer than a fit around the cargo centre', () => {
    const vehicle = hd210()
    const center: Vec3 = [3.6, 1.2, 1.175]
    const points = specFramePoints(vehicle).map((p): Vec3 => [p[0] - center[0], p[1] - center[1], p[2] - center[2]])
    const direction: Vec3 = [8.5, 5.2, 7]
    const camera = { tanHalfH: 0.459, tanHalfV: 0.344, margin: 1.08, minDistance: 3 }
    const fit = fitFrame(points, direction, camera)

    const length = Math.hypot(...direction)
    const forward = direction.map((value) => value / length)
    const right = [forward[2]! / Math.hypot(forward[0]!, forward[2]!), 0, -forward[0]! / Math.hypot(forward[0]!, forward[2]!)]
    const up = [forward[1]! * right[2]!, forward[2]! * right[0]! - forward[0]! * right[2]!, -forward[1]! * right[0]!]
    const along = (point: Vec3, axis: readonly number[]) => point.reduce((sum, value, i) => sum + (value - fit.target[i]!) * axis[i]!, 0)
    for (const point of points) {
      const depth = fit.distance - along(point, forward)
      expect(Math.abs(along(point, right)) * camera.margin).toBeLessThanOrEqual(camera.tanHalfH * depth + 1e-6)
      expect(Math.abs(along(point, up)) * camera.margin).toBeLessThanOrEqual(camera.tanHalfV * depth + 1e-6)
    }

    // Cùng các điểm đó, tâm nhìn giữ ở tâm thùng
    let centred = camera.minDistance
    for (const point of points) {
      const r = point.reduce((sum, value, i) => sum + value * right[i]!, 0)
      const u = point.reduce((sum, value, i) => sum + value * up[i]!, 0)
      const depth = point.reduce((sum, value, i) => sum + value * forward[i]!, 0)
      centred = Math.max(centred, depth + Math.abs(r) * camera.margin / camera.tanHalfH, depth + Math.abs(u) * camera.margin / camera.tanHalfV)
    }
    expect(fit.distance).toBeLessThan(centred)
  })
})
