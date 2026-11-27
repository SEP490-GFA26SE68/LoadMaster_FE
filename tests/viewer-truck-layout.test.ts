import { describe, expect, test } from 'vitest'
import type { VehicleAxle, VehicleObstacle } from '@/domain/models'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import { vehicleFitCorners } from '@/features/viewer3d/scene/frame-fit'
import { truckLayout, vehicleFrameKey, type TruckLayoutInput } from '@/features/viewer3d/scene/truck-layout'
import { vehicleClassOf } from '@/features/viewer3d/scene/vehicle-class'
import { DIORAMA } from '@/features/viewer3d/landing/diorama-layout'
import { LANDING_REQUEST } from '@/features/marketing/landing-sample.mock'

const truck = (innerLengthCm: number, maxPayloadKg: number, extra: Partial<TruckLayoutInput> = {}): TruckLayoutInput =>
  ({ innerLengthCm, innerWidthCm: 235, innerHeightCm: 240, maxPayloadKg, ...extra })
const axle = (id: string, positionXCm: number): VehicleAxle => ({ id, name: id, positionXCm, emptyLoadKg: 0, maxLoadKg: 0 })
const cooling: VehicleObstacle = {
  id: 'OBS-1', type: 'COOLING_UNIT', xCm: 0, yCm: 40, zCm: 150, lengthCm: 30, widthCm: 150, heightCm: 80, loadBearing: false, maxTopLoadKg: null,
}

describe('vehicleClassOf', () => {
  test('payload picks the class, with named thresholds at the boundaries', () => {
    expect(vehicleClassOf(truck(320, 1200))).toBe('van')
    expect(vehicleClassOf(truck(320, 1201))).toBe('light')
    expect(vehicleClassOf(truck(620, 5500))).toBe('light')
    expect(vehicleClassOf(truck(620, 5501))).toBe('medium')
    expect(vehicleClassOf(truck(720, 12000))).toBe('medium')
    expect(vehicleClassOf(truck(720, 12001))).toBe('heavy')
  })

  test('a small payload makes a van only while the box is short enough to be one', () => {
    expect(vehicleClassOf(truck(420, 1000))).toBe('van')
    expect(vehicleClassOf(truck(421, 1000))).toBe('light')
    expect(vehicleClassOf(truck(520, 1000))).toBe('light')
  })

  test('a short box is a van, a long box or three axles is heavy, whatever the payload', () => {
    expect(vehicleClassOf(truck(300, 3000))).toBe('van')
    expect(vehicleClassOf(truck(900, 3000))).toBe('heavy')
    expect(vehicleClassOf(truck(600, 3000, { axles: [axle('A', -100), axle('B', 400), axle('C', 530)] }))).toBe('heavy')
  })

  test('without a usable payload the class follows the box length', () => {
    expect(vehicleClassOf(truck(280, 0))).toBe('van')
    expect(vehicleClassOf(truck(600, Number.NaN))).toBe('light')
    expect(vehicleClassOf(truck(720, 0))).toBe('medium')
    expect(vehicleClassOf(truck(870, -1))).toBe('heavy')
  })
})

describe('truckLayout', () => {
  const classes = [truck(300, 900), truck(520, 3500), truck(720, 9500), truck(950, 15000)]

  test('the floor rises with the class and the wheels stand on the ground', () => {
    // truckLayout nhận thêm kiểu thân ở tham số thứ hai: không đưa chỉ số của map vào đó
    const layouts = classes.map((vehicle) => truckLayout(vehicle))
    expect(layouts.map((l) => l.vehicleClass)).toStrictEqual(['van', 'light', 'medium', 'heavy'])
    const grounds = layouts.map((l) => l.groundY)
    expect(grounds).toStrictEqual([...grounds].sort((a, b) => b - a))
    for (const layout of layouts) expect(layout.wheelY - layout.wheelRadius).toBeCloseTo(layout.groundY, 9)
  })

  test('default axles per class: two axles up to medium, a rear tandem on heavy', () => {
    const counts = classes.map((v) => truckLayout(v).axles.map((a) => `${a.kind}${a.dual ? '2' : ''}`))
    expect(counts).toStrictEqual([['steer', 'drive'], ['steer', 'drive2'], ['steer', 'drive2'], ['steer', 'drive2', 'drive2']])
    // Tải nhẹ dưới 2,5 tấn: bánh sau đơn
    expect(truckLayout(truck(450, 1900)).axles[1]!.dual).toBe(false)
  })

  test('declared axles are drawn exactly at positionXCm, the first one steering', () => {
    for (const vehicle of classes) {
      const layout = truckLayout({ ...vehicle, axles: [axle('A2', 480), axle('A1', -100)] })
      expect(layout.axles.map(({ x, kind }) => ({ x, kind }))).toStrictEqual([{ x: -1, kind: 'steer' }, { x: 4.8, kind: 'drive' }])
    }
  })

  test('the cab covers the front wheel, even when the front axle is declared far forward', () => {
    for (const vehicle of classes) {
      for (const front of [-100, -160]) {
        const layout = truckLayout({ ...vehicle, axles: [axle('A1', front), axle('A2', 400)] })
        const steer = layout.axles[0]!.x
        expect(layout.cab.frontX).toBeLessThan(steer - layout.wheelRadius)
        expect(layout.cab.backX).toBeGreaterThan(steer)
        expect(layout.cab.bottomY).toBeGreaterThan(layout.wheelY + layout.wheelRadius)
        expect(layout.footprint.x[0]).toBeLessThan(layout.cab.frontX)
      }
    }
  })

  test('every wheel stays inside the footprint and the body width', () => {
    for (const vehicle of classes) {
      const layout = truckLayout(vehicle)
      for (const { x, z } of layout.wheels) {
        expect(x - layout.wheelRadius).toBeGreaterThan(layout.footprint.x[0])
        expect(x + layout.wheelRadius).toBeLessThan(layout.footprint.x[1])
        expect(z).toBeGreaterThan(0)
        expect(z).toBeLessThan(2.35)
      }
    }
  })

  test('the frame reaches past the rear door and the driveshaft reaches every drive axle', () => {
    const layout = truckLayout(classes[3]!)
    expect(layout.frame.toX).toBeGreaterThan(9.5)
    expect(layout.driveshaft.map((s) => s.toX)).toStrictEqual(layout.axles.filter((a) => a.kind === 'drive').map((a) => a.x))
  })

  test('a reefer is drawn only when the vehicle declares a COOLING_UNIT', () => {
    expect(truckLayout(classes[2]!).reefer).toBeNull()
    const reefer = truckLayout({ ...classes[2]!, obstacles: [cooling] }).reefer
    expect(reefer).not.toBeNull()
    expect(reefer!.x[1]).toBeLessThanOrEqual(0)
    expect(reefer!.y[1]).toBeLessThanOrEqual(2.4)
  })

  test('the landing truck keeps its ground at the road and its exhaust where the smoke starts', () => {
    const layout = truckLayout(LANDING_REQUEST.vehicle)
    expect(layout.vehicleClass).toBe('light')
    expect(layout.groundY).toBeCloseTo(-1.1, 9)
    expect(layout.exhaust.map((v) => Number(v.toFixed(2)))).toStrictEqual([0.3, -0.62, 2.42])
    const { truck: box } = DIORAMA
    expect(layout.footprint.x[0]).toBeGreaterThanOrEqual(box.x[0])
    expect(layout.cab.topY).toBeLessThanOrEqual(box.y[1])
    expect(layout.footprint.z[0]).toBeGreaterThanOrEqual(box.z[0])
    expect(layout.footprint.z[1]).toBeLessThanOrEqual(box.z[1])
  })
})

describe('camera framing follows the class', () => {
  test('the frame key changes with the class, not with a payload inside the same class', () => {
    expect(vehicleFrameKey(truck(720, 9000))).toBe(vehicleFrameKey(truck(720, 9500)))
    expect(vehicleFrameKey(truck(720, 9500))).not.toBe(vehicleFrameKey(truck(720, 15000)))
  })

  test('fit corners reach the ground and the cab nose of the class', () => {
    for (const vehicle of [truck(300, 900), truck(950, 15000), SPEC_TRUCK_6M]) {
      const layout = truckLayout(vehicle)
      const corners = vehicleFitCorners(vehicle, true)
      expect(Math.min(...corners.map((p) => p[1]))).toBeCloseTo(layout.groundY, 9)
      expect(Math.min(...corners.map((p) => p[0]))).toBeCloseTo(layout.footprint.x[0], 9)
    }
    expect(Math.min(...vehicleFitCorners(SPEC_TRUCK_6M, false).map((p) => p[1]))).toBe(0)
  })
})
