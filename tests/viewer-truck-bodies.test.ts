import { describe, expect, test } from 'vitest'
import type { VehicleAxle, VehicleObstacle } from '@/domain/models'
import { sceneMaterials } from '@/features/viewer3d/scene/materials'
import {
  BOARD_MAX, BOARD_MIN, boardHeight, headboardHeight, pieceBounds, TAILGATE_THICKNESS, tailgateHeight, tailgatePieces, type BodyPiece,
} from '@/features/viewer3d/scene/body-pieces'
import { containerEdges, type ContainerBox } from '@/features/viewer3d/scene/container-structure'
import { truckBodyExterior } from '@/features/viewer3d/scene/truck-body-exterior'
import { truckBodyShell, type BodyShellColors } from '@/features/viewer3d/scene/truck-body-shells'
import {
  chassisNumbersOf, FRONT_BUMPER_OUT, FRONT_OVERHANG, REAR_OVERHANG_RATIO, type TruckClass,
} from '@/features/viewer3d/scene/truck-chassis-numbers'
import { truckDetails, truckSimpleDetails } from '@/features/viewer3d/scene/truck-geometry'
import { truckLayout, type TruckLayoutInput } from '@/features/viewer3d/scene/truck-layout'
import { toScene } from '@/features/viewer3d/scene/units'
import { doorOpening } from '@/features/viewer3d/scene/vehicle-spec-marks'
import { TRUCK_BODY_STYLES } from '@/types/vehicle-body-style'

const truck = (innerLengthCm: number, innerWidthCm: number, innerHeightCm: number, maxPayloadKg: number, extra: Partial<TruckLayoutInput> = {}): TruckLayoutInput =>
  ({ innerLengthCm, innerWidthCm, innerHeightCm, maxPayloadKg, ...extra })
const axle = (id: string, positionXCm: number): VehicleAxle => ({ id, name: id, positionXCm, emptyLoadKg: 0, maxLoadKg: 0 })
const cooling: VehicleObstacle = {
  id: 'OBS-1', type: 'COOLING_UNIT', xCm: 0, yCm: 40, zCm: 150, lengthCm: 30, widthCm: 150, heightCm: 80, loadBearing: false, maxTopLoadKg: null,
}
const boxOf = (v: TruckLayoutInput): ContainerBox =>
  ({ length: toScene(v.innerLengthCm), width: toScene(v.innerWidthCm), height: toScene(v.innerHeightCm) })

/** Xe tải nhẹ, trung, nặng — có và không có trục khai — thêm một thùng thấp để thành lửng chạm trần. */
const VEHICLES: TruckLayoutInput[] = [
  truck(430, 185, 190, 1900),
  truck(620, 210, 220, 5000, { axles: [axle('A1', -100), axle('A2', 380)] }),
  truck(720, 235, 240, 9000),
  truck(960, 245, 260, 15_000),
  truck(500, 200, 35, 3500),
]
const CASES = TRUCK_BODY_STYLES.flatMap((body) => VEHICLES.flatMap((vehicle) => [true, false].map((detail) => ({ body, vehicle, detail }))))

/** Mảnh không chạm vào khoảng mở (0, L) × (0, H) × (0, W) của lòng thùng. */
function apart(piece: BodyPiece, { length: L, width: W, height: H }: ContainerBox): boolean {
  const { min, max } = pieceBounds(piece)
  return max[0] <= 1e-9 || min[0] >= L - 1e-9 || max[1] <= 1e-9 || min[1] >= H - 1e-9 || max[2] <= 1e-9 || min[2] >= W - 1e-9
}

describe('board, headboard and tailgate heights', () => {
  test('boards are a quarter of the inner height inside 0.4–0.6 m and never taller than the box', () => {
    expect(boardHeight(2.4)).toBe(BOARD_MAX)
    expect(boardHeight(1.8)).toBeCloseTo(0.45, 9)
    expect(boardHeight(1.2)).toBe(BOARD_MIN)
    expect(boardHeight(0.35)).toBe(0.35)
    expect(headboardHeight(2.4)).toBe(1)
    expect(headboardHeight(0.8)).toBe(0.8)
    expect(headboardHeight(0.35)).toBe(0.35)
  })

  test('the tailgate stands as high as the boards but never above the door opening', () => {
    expect(tailgateHeight(2.4, 2.3)).toBe(BOARD_MAX)
    expect(tailgateHeight(2.4, 0.5)).toBe(0.5)
  })

  test('only the canvas and flatbed bodies get a tailgate, sized from the boards', () => {
    const v = truck(620, 210, 220, 5000)
    expect(truckLayout(v, 'TRUCK_BOX').tailgate).toBeNull()
    expect(truckLayout(v, 'TRUCK_REEFER').tailgate).toBeNull()
    expect(truckLayout(v, 'TRUCK_CANVAS').tailgate).toBe(boardHeight(2.2))
    expect(truckLayout(v, 'TRUCK_FLATBED').tailgate).toBe(boardHeight(2.2))
    // Bửng thõng ngay sau mép sàn: khung sườn dừng sát đuôi sàn thay vì chìa 12 cm
    expect(truckLayout(v, 'TRUCK_CANVAS').frame.toX).toBeCloseTo(6.22, 9)
    expect(truckLayout(v, 'TRUCK_BOX').frame.toX).toBeCloseTo(6.32, 9)
  })
})

describe('truck bodies keep the cargo box clear', () => {
  test.each(CASES)('no exterior piece of $body enters the box ($vehicle.innerLengthCm cm, detail $detail)', ({ body, vehicle, detail }) => {
    const box = boxOf(vehicle)
    const pieces = truckBodyExterior(body, box, detail)
    expect(pieces.length).toBeGreaterThan(0)
    for (const piece of pieces) expect(apart(piece, box)).toBe(true)
  })

  test.each(TRUCK_BODY_STYLES)('no chassis, cab or rear detail vertex of %s enters the box', (body) => {
    const materials = sceneMaterials()
    for (const vehicle of VEHICLES) {
      const box = boxOf(vehicle)
      const layout = truckLayout({ ...vehicle, obstacles: [cooling] }, body)
      const inside = (x: number, y: number, z: number) =>
        x > 1e-3 && x < box.length - 1e-3 && y > 1e-3 && y < box.height - 1e-3 && z > 1e-3 && z < box.width - 1e-3
      for (const geometry of [truckDetails(box.length, box.width, layout, materials), truckSimpleDetails(box.length, box.width, layout, materials)]) {
        const position = geometry.getAttribute('position')
        for (let i = 0; i < position.count; i++) expect(inside(position.getX(i), position.getY(i), position.getZ(i))).toBe(false)
        expect(geometry.getAttribute('color').count).toBe(position.count)
        geometry.dispose()
      }
    }
  })

  test.each([true, false])('the tailgate stays behind the rear sill through its whole swing (detail %s)', (detail) => {
    const L = 6.2, h = boardHeight(2.2)
    const pieces = tailgatePieces(h, 2, 0.05, detail)
    for (let step = 0; step <= 16; step++) {
      const angle = -Math.PI * step / 16, cos = Math.cos(angle), sin = Math.sin(angle)
      for (const piece of pieces) {
        const { min, max } = pieceBounds(piece)
        for (const x of [min[0], max[0]]) for (const y of [min[1], max[1]]) {
          // Nhóm bửng đặt tại x = L + dày, quay quanh z
          expect(L + TAILGATE_THICKNESS + x * cos - y * sin).toBeGreaterThanOrEqual(L - 1e-9)
        }
        expect(min[2]).toBeGreaterThanOrEqual(0.05 - 1e-9)
        expect(max[2]).toBeLessThanOrEqual(2.05 + 1e-9)
      }
    }
    // Dựng lên: cao đúng chiều cao bửng, phủ đúng bề rộng ô cửa
    const slab = pieceBounds(pieces[0]!)
    expect(slab.max[1] - slab.min[1]).toBeCloseTo(h, 9)
    expect(slab.max[2] - slab.min[2]).toBeCloseTo(2, 9)
  })
})

describe('truck body shells', () => {
  const colors: BodyShellColors = {
    floor: [0.5, 0.4, 0.3], wall: [0.8, 0.8, 0.8], trim: [0.3, 0.3, 0.3], tarp: [0, 0.4, 0.5], insulated: [1, 1, 1], metal: [0.6, 0.6, 0.6],
  }
  const box = { length: 6.2, width: 2.1, height: 2.2 }

  test.each(TRUCK_BODY_STYLES.flatMap((body) => [true, false].map((detail) => ({ body, detail }))))(
    '$body lines the box with single faces whose normals point inward (detail $detail)', ({ body, detail }) => {
      const shell = truckBodyShell(body, box, colors, detail)
      const center = [box.length / 2, box.height / 2, box.width / 2]
      expect(shell.colors.length).toBe(shell.positions.length)
      for (let i = 0; i < shell.positions.length; i += 3) {
        const p = [shell.positions[i]!, shell.positions[i + 1]!, shell.positions[i + 2]!]
        expect(p[0]).toBeGreaterThanOrEqual(-1e-6); expect(p[0]).toBeLessThanOrEqual(box.length + 1e-6)
        expect(p[1]).toBeGreaterThanOrEqual(-1e-6); expect(p[1]).toBeLessThanOrEqual(box.height + 1e-6)
        expect(p[2]).toBeGreaterThanOrEqual(-1e-6); expect(p[2]).toBeLessThanOrEqual(box.width + 1e-6)
        const n = [shell.normals[i]!, shell.normals[i + 1]!, shell.normals[i + 2]!]
        expect(n[0]! * (center[0]! - p[0]!) + n[1]! * (center[1]! - p[1]!) + n[2]! * (center[2]! - p[2]!)).toBeGreaterThan(0)
      }
      // Không có vách sau; chỉ mui bạt có nóc (mặt hướng xuống)
      const normalsY = Array.from({ length: shell.normals.length / 3 }, (_, i) => shell.normals[i * 3 + 1]!)
      for (let i = 0; i < shell.normals.length; i += 3) expect(shell.normals[i]).not.toBe(-1)
      expect(normalsY.some((y) => y === -1)).toBe(body === 'TRUCK_CANVAS')
      // Lửng: vách chỉ cao tới tấm chắn đầu
      if (body === 'TRUCK_FLATBED') {
        const ys = Array.from({ length: shell.positions.length / 3 }, (_, i) => shell.positions[i * 3 + 1]!)
        expect(Math.max(...ys)).toBeCloseTo(headboardHeight(box.height), 6)
      }
    })

  test('every body keeps the 12 edges of the inner box', () => {
    expect(containerEdges(box).length).toBe(12 * 2 * 3)
  })
})

describe('rear opening and cooling unit', () => {
  test('the door opening is exactly the typed width × height', () => {
    const door = doorOpening({ innerWidthCm: 235, innerHeightCm: 240, doorWidthCm: 220, doorHeightCm: 230 })
    expect(door.width).toBeCloseTo(2.2, 9)
    expect(door.height).toBeCloseTo(2.3, 9)
    expect(door.jamb).toBeCloseTo(0.075, 9)
    expect(door.header).toBeCloseTo(0.1, 9)
  })

  test('the cooling unit is drawn only when the vehicle declares COOLING_UNIT', () => {
    const v = truck(620, 210, 220, 5000)
    expect(truckLayout(v, 'TRUCK_REEFER').reefer).toBeNull()
    expect(truckLayout({ ...v, obstacles: [cooling] }, 'TRUCK_REEFER').reefer).not.toBeNull()
    expect(truckLayout({ ...v, obstacles: [cooling] }).body).toBe('TRUCK_REEFER')
    expect(truckLayout(v).body).toBe('TRUCK_BOX')
  })
})

describe('chassis numbers from real trucks', () => {
  test('wheel diameter, floor height and cab roof follow the payload inside each class', () => {
    expect(chassisNumbersOf('light', 1900).wheelRadius * 2).toBeCloseTo(0.73, 9)
    expect(chassisNumbersOf('light', 3500).wheelRadius * 2).toBeCloseTo(0.8, 9)
    expect(chassisNumbersOf('light', 2750).wheelRadius * 2).toBeCloseTo(0.765, 9)
    expect(chassisNumbersOf('light', 5000).wheelRadius * 2).toBeCloseTo(0.845, 9)
    expect(chassisNumbersOf('medium', 9000).wheelRadius * 2).toBeCloseTo(1.035, 9)
    expect(chassisNumbersOf('heavy', 30_000).wheelRadius * 2).toBeCloseTo(1.075, 9)
    expect(chassisNumbersOf('medium', 0)).toStrictEqual(chassisNumbersOf('medium', 9000))
    const fvr = chassisNumbersOf('medium', 9000)
    expect(fvr.floorHeight).toBeCloseTo(1.3, 9)
    expect(fvr.cabTop + fvr.floorHeight).toBeCloseTo(2.88, 9)
  })

  test('the drawn truck stands on its tyres at the class floor height', () => {
    const layout = truckLayout(truck(620, 210, 220, 3500))
    expect(layout.groundY).toBeCloseTo(-1.02, 9)
    expect(layout.wheelRadius * 2).toBeCloseTo(0.8, 9)
    expect(layout.wheelY - layout.wheelRadius).toBeCloseTo(layout.groundY, 9)
  })

  test.each<[TruckClass, TruckLayoutInput]>([
    ['light', truck(620, 210, 220, 3500)], ['medium', truck(720, 235, 240, 9000)], ['heavy', truck(960, 245, 260, 15_000)],
  ])('default %s axles: front overhang and rear overhang ratio of the class', (cls, vehicle) => {
    const layout = truckLayout(vehicle), L = toScene(vehicle.innerLengthCm)
    const steer = layout.axles[0]!.x
    const drive = layout.axles.slice(1).map((a) => a.x)
    const rear = drive.reduce((sum, x) => sum + x, 0) / drive.length
    expect(steer - (layout.cab.frontX - FRONT_BUMPER_OUT)).toBeCloseTo(FRONT_OVERHANG[cls], 6)
    expect((L + 0.1 - rear) / (rear - steer)).toBeCloseTo(REAR_OVERHANG_RATIO[cls], 6)
  })

  test('declared axles stay exactly where they are declared on every body', () => {
    for (const body of TRUCK_BODY_STYLES) {
      const layout = truckLayout(truck(620, 210, 220, 5000, { axles: [axle('A2', 380), axle('A1', -100)] }), body)
      expect(layout.axles.map((a) => a.x)).toStrictEqual([toScene(-100), toScene(380)])
    }
  })
})
