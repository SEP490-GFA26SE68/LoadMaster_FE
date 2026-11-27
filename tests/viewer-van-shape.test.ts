import { describe, expect, test } from 'vitest'
import type { VehicleAxle, VehicleConfig } from '@/domain/models'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import { sceneMaterials } from '@/features/viewer3d/scene/materials'
import { truckLayout, vehicleFrameKey } from '@/features/viewer3d/scene/truck-layout'
import { toScene } from '@/features/viewer3d/scene/units'
import { vanExterior, vanShell } from '@/features/viewer3d/scene/van-body'
import { vanDetails, vanSimpleDetails } from '@/features/viewer3d/scene/van-details'
import { liftgateTip, vanShapeOf, vanStyleOf, type VanShapeInput } from '@/features/viewer3d/scene/van-shape'
import { doorOpening, vehicleSpecMarks } from '@/features/viewer3d/scene/vehicle-spec-marks'
import { VEHICLE_BODY_STYLES, type VehicleBodyStyle } from '@/types/vehicle-body-style'

const van = (innerLengthCm: number, innerWidthCm: number, innerHeightCm: number, maxPayloadKg: number, axles?: VehicleAxle[]): VanShapeInput =>
  ({ innerLengthCm, innerWidthCm, innerHeightCm, maxPayloadKg, ...(axles ? { axles } : {}) })
const axle = (id: string, positionXCm: number): VehicleAxle => ({ id, name: id, positionXCm, emptyLoadKg: 0, maxLoadKg: 0 })

/** Lòng thùng của các xe tham chiếu (ghi chú tham chiếu mục A). */
const REFERENCE: Record<string, { vehicle: VanShapeInput; style: VehicleBodyStyle }> = {
  'Suzuki Blind Van': { vehicle: van(170, 127, 119, 580), style: 'VAN_MINI_FLAT' },
  'Kenbo Van 2S': { vehicle: van(217, 127, 121, 945), style: 'VAN_MINI_HOOD' },
  'Towner TF420V': { vehicle: van(233, 150.5, 134, 945), style: 'VAN_MINI_HOOD' },
  'HiAce LWB': { vehicle: van(253, 176, 134, 1000), style: 'VAN_MID' },
  'Transit L2H2': { vehicle: van(308, 178, 189, 1200), style: 'VAN_LARGE' },
}

/** Mọi dáng trên vài lòng thùng (nhỏ, tham chiếu, lớn), có và không có trục khai. */
const CASES = VEHICLE_BODY_STYLES.flatMap((style) => [
  van(150, 120, 110, 500), van(253, 176, 134, 1000), van(330, 180, 200, 1200),
  van(253, 176, 134, 1000, [axle('A1', -100), axle('A2', 200)]), van(308, 178, 189, 1200, [axle('A2', 230), axle('A1', -160)]),
].map((vehicle) => ({ style, vehicle })))

describe('vanStyleOf', () => {
  test.each(Object.entries(REFERENCE))('%s gets its own shape', (_, { vehicle, style }) => {
    expect(vanStyleOf(vehicle)).toBe(style)
  })

  test('a declared style beats the heuristic and always draws a van', () => {
    expect(vanShapeOf(REFERENCE['Suzuki Blind Van']!.vehicle, 'VAN_LARGE').style).toBe('VAN_LARGE')
    expect(vanShapeOf(REFERENCE['Transit L2H2']!.vehicle, 'VAN_MINI_FLAT').style).toBe('VAN_MINI_FLAT')
    const heavy = { innerLengthCm: 720, innerWidthCm: 235, innerHeightCm: 240, maxPayloadKg: 9500 }
    expect(truckLayout(heavy).vehicleClass).toBe('medium')
    expect(truckLayout(heavy).van).toBeNull()
    const declared = truckLayout(heavy, 'VAN_MID')
    expect(declared.vehicleClass).toBe('van')
    expect(declared.van?.style).toBe('VAN_MID')
  })

  test('the rear door is a liftgate on the minis and the HiAce, two swing doors on the Transit', () => {
    const doors = VEHICLE_BODY_STYLES.map((style) => vanShapeOf(REFERENCE['HiAce LWB']!.vehicle, style).rearDoor)
    expect(doors).toStrictEqual(['liftgate', 'liftgate', 'liftgate', 'swing'])
  })
})

describe('vanShapeOf invariants', () => {
  test.each(CASES)('$style around $vehicle.innerLengthCm × $vehicle.innerWidthCm × $vehicle.innerHeightCm', ({ style, vehicle }) => {
    const shape = vanShapeOf(vehicle, style)
    const L = toScene(vehicle.innerLengthCm), W = toScene(vehicle.innerWidthCm), H = toScene(vehicle.innerHeightCm)
    // Lòng thùng nằm trong thân: nóc trên trần, vách dày dương, mũi trước vách trước, sàn trên chân thân
    expect(shape.roofY).toBeGreaterThan(H)
    expect(shape.wall).toBeGreaterThan(0)
    expect(Math.max(...shape.outline.map(([x]) => x))).toBe(shape.back)
    expect(shape.back).toBeLessThan(0)
    expect(shape.back).toBeGreaterThan(-0.02)
    expect(Math.min(...shape.outline.map(([, y]) => y))).toBe(0)
    expect(Math.max(...shape.outline.map(([, y]) => y))).toBe(shape.roofY)
    expect(shape.sillY).toBeLessThan(0)
    // Bánh dưới sàn, đứng trên đất, trong hốc bánh (hốc cắt vào chân thân), lốp không lòi ra ngoài vách
    expect(shape.wheelY - shape.wheelRadius).toBeCloseTo(shape.groundY, 9)
    expect(shape.wheelY + shape.wheelRadius).toBeLessThan(0)
    expect(shape.archRadius).toBeGreaterThan(shape.wheelRadius)
    expect(Math.abs(shape.sillY - shape.wheelY)).toBeLessThan(shape.archRadius)
    expect(shape.sillY).toBeGreaterThan(shape.groundY)
    expect(shape.wheelZ[0] - shape.tireWidth / 2).toBeGreaterThanOrEqual(-shape.wall)
    expect(shape.wheelZ[1] + shape.tireWidth / 2).toBeLessThanOrEqual(W + shape.wall)
    // Mũi phủ cầu trước; mọi hốc bánh nằm giữa mũi và cửa sau
    expect(shape.front).toBeLessThan(shape.axles[0]! - shape.archRadius)
    for (const x of shape.axles) {
      expect(x - shape.archRadius).toBeGreaterThan(shape.front)
      expect(x + shape.archRadius).toBeLessThan(L)
    }
    // Kính chắn gió đi lên về phía sau, nằm trong mũi
    expect(shape.windshieldTop[1]).toBeGreaterThan(shape.cowl[1])
    expect(shape.windshieldTop[0]).toBeGreaterThan(shape.cowl[0])
    expect(shape.windshieldTop[0]).toBeLessThan(shape.back)
  })

  test('declared axles are placed exactly at positionXCm, negative ones under the nose', () => {
    for (const style of VEHICLE_BODY_STYLES) {
      const shape = vanShapeOf(van(253, 176, 134, 1000, [axle('A2', 230), axle('A1', -100)]), style)
      expect(shape.axles).toStrictEqual([toScene(-100), toScene(230)])
      expect(shape.front).toBeLessThan(-1)
      expect(shape.back).toBeGreaterThan(-1)
      // Cầu trước khai xa hơn mũi của dáng: mũi dài ra
      const far = vanShapeOf(van(253, 176, 134, 1000, [axle('A1', -400), axle('A2', 200)]), style)
      expect(far.front).toBeLessThan(-4 - far.archRadius)
    }
  })

  test('without declared axles the wheels are sensible: two axles, a real wheelbase, the rear wheel inside the box length', () => {
    for (const style of VEHICLE_BODY_STYLES) {
      for (const lengthCm of [120, 170, 253, 360]) {
        const shape = vanShapeOf(van(lengthCm, 150, 130, 900), style)
        const [steer, rear] = shape.axles
        expect(shape.axles).toHaveLength(2)
        expect(steer).toBeLessThan(0)
        expect(rear! - steer!).toBeGreaterThanOrEqual(shape.wheelRadius * 2 + 0.3 - 1e-9)
        expect(rear! + shape.wheelRadius).toBeLessThanOrEqual(toScene(lengthCm))
      }
    }
  })

  test('the open liftgate tip lies behind the door and above the floor', () => {
    const [x, y] = liftgateTip(2.53, 1.2)
    expect(x).toBeGreaterThan(2.53 + 1)
    expect(y).toBeGreaterThan(1.2)
  })
})

describe('van layout and frame key', () => {
  test('trucks keep their layout and key; a van key names its shape', () => {
    const truck = { innerLengthCm: 520, innerWidthCm: 235, innerHeightCm: 240, maxPayloadKg: 3500 }
    expect(truckLayout(truck).van).toBeNull()
    expect(vehicleFrameKey(truck)).not.toMatch(/VAN_/)
    const hiace = REFERENCE['HiAce LWB']!.vehicle
    expect(vehicleFrameKey(hiace)).toContain(':VAN_MID:')
    expect(vehicleFrameKey(hiace, 'VAN_LARGE')).toContain(':VAN_LARGE:')
    expect(vehicleFrameKey(hiace, 'VAN_LARGE')).not.toBe(vehicleFrameKey(hiace, 'VAN_MID'))
  })

  test('the van layout takes floor, wheels, nose and axles from the shape', () => {
    for (const style of VEHICLE_BODY_STYLES) {
      const vehicle = REFERENCE['HiAce LWB']!.vehicle
      const layout = truckLayout(vehicle, style), shape = layout.van!
      expect(layout.groundY).toBe(shape.groundY)
      expect(layout.wheelRadius).toBe(shape.wheelRadius)
      expect(layout.cab.frontX).toBe(shape.front)
      expect(layout.cab.profile).toBe(shape.outline)
      expect(layout.axles.map((a) => a.x)).toStrictEqual(shape.axles)
      expect(layout.axles.every((a) => !a.dual)).toBe(true)
      expect(layout.wheels.map((w) => w.z)).toStrictEqual(shape.axles.flatMap(() => shape.wheelZ))
      expect(layout.footprint.x[0]).toBeLessThan(shape.front)
    }
  })

  test('the form-preview door opening stays exactly doorWidthCm × doorHeightCm on a van', () => {
    const vehicle: VehicleConfig = { ...SPEC_TRUCK_6M, innerLengthCm: 253, innerWidthCm: 176, innerHeightCm: 134, doorWidthCm: 150,
      doorHeightCm: 120, maxPayloadKg: 1000, axles: [] }
    const door = doorOpening(vehicle)
    expect(door.width).toBeCloseTo(1.5, 9)
    expect(door.height).toBeCloseTo(1.2, 9)
    for (const style of VEHICLE_BODY_STYLES) {
      const doorSegments = vehicleSpecMarks(vehicle, style).segments.filter((s) => s.role === 'door')
      const zs = doorSegments.flatMap((s) => [s.from[2], s.to[2]]), ys = doorSegments.flatMap((s) => [s.from[1], s.to[1]])
      expect(Math.max(...zs) - Math.min(...zs)).toBeCloseTo(1.5, 9)
      expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(1.2, 9)
    }
  })
})

describe('van body geometry keeps the cargo visible', () => {
  const box = { length: 2.53, width: 1.76, height: 1.34 }
  const colors = { floor: [0.5, 0.4, 0.3], wall: [0.8, 0.8, 0.8], seam: [0.3, 0.3, 0.3] } as const

  test.each([true, false])('the shell lines the box with single faces whose normals point inward (detail %s)', (detail) => {
    const shell = vanShell(box, colors, detail)
    const center = [box.length / 2, box.height / 2, box.width / 2]
    for (let i = 0; i < shell.positions.length; i += 3) {
      const p = [shell.positions[i]!, shell.positions[i + 1]!, shell.positions[i + 2]!]
      expect(p[0]).toBeGreaterThanOrEqual(-1e-6); expect(p[0]).toBeLessThanOrEqual(box.length + 1e-6)
      expect(p[1]).toBeGreaterThanOrEqual(-1e-6); expect(p[1]).toBeLessThanOrEqual(box.height + 1e-6)
      expect(p[2]).toBeGreaterThanOrEqual(-1e-6); expect(p[2]).toBeLessThanOrEqual(box.width + 1e-6)
      const n = [shell.normals[i]!, shell.normals[i + 1]!, shell.normals[i + 2]!]
      const toward = n[0]! * (center[0]! - p[0]!) + n[1]! * (center[1]! - p[1]!) + n[2]! * (center[2]! - p[2]!)
      expect(toward).toBeGreaterThan(0)
    }
    // Không có vách sau: cửa sau để ngỏ
    for (let i = 0; i < shell.normals.length; i += 3) expect(shell.normals[i]).not.toBe(-1)
  })

  test.each(VEHICLE_BODY_STYLES)('no exterior piece or detail vertex of %s enters the cargo box', (style) => {
    const vehicle = van(253, 176, 134, 1000)
    const layout = truckLayout(vehicle, style), shape = layout.van!
    const inside = (x: number, y: number, z: number) =>
      x > 1e-3 && x < box.length - 1e-3 && y > 1e-3 && y < box.height - 1e-3 && z > 1e-3 && z < box.width - 1e-3
    for (const piece of vanExterior(box, shape)) {
      if (piece.kind === 'rod') {
        // Thanh tròn dọc x: tiết diện không chạm vào khoảng (0, H) × (0, W) của lòng thùng
        const apart = piece.y - piece.radius >= box.height - 1e-9 || piece.z + piece.radius <= 1e-9 || piece.z - piece.radius >= box.width - 1e-9
        expect(apart).toBe(true)
        continue
      }
      const { min, max } = piece
      const apart = max[0] <= 1e-9 || min[0] >= box.length - 1e-9 || max[1] <= 1e-9 || min[1] >= box.height - 1e-9
        || max[2] <= 1e-9 || min[2] >= box.width - 1e-9
      expect(apart).toBe(true)
    }
    const materials = sceneMaterials()
    for (const geometry of [vanDetails(box.length, box.width, box.height, layout, materials), vanSimpleDetails(box.length, box.width, layout, materials)]) {
      const position = geometry.getAttribute('position')
      for (let i = 0; i < position.count; i++) expect(inside(position.getX(i), position.getY(i), position.getZ(i))).toBe(false)
      expect(geometry.getAttribute('color').count).toBe(position.count)
      geometry.dispose()
    }
  })

  test('the low tier keeps the shape with far fewer triangles', () => {
    const layout = truckLayout(van(308, 178, 189, 1200), 'VAN_LARGE'), materials = sceneMaterials()
    const full = vanDetails(3.08, 1.78, 1.89, layout, materials), simple = vanSimpleDetails(3.08, 1.78, layout, materials)
    expect(simple.getAttribute('position').count).toBeLessThan(full.getAttribute('position').count / 2)
    full.dispose(); simple.dispose()
  })
})
