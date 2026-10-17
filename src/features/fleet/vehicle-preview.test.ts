import { describe, expect, test } from 'vitest'
import { EMPTY_PREVIEW, nextFacts, nextPreview, passableOpening, previewFacts, previewVehicle } from './vehicle-preview'

/** Giá trị form của xe Hyundai HD210 trong seed: thùng 720 × 235 × 240 cm, hai hốc bánh ở x = 420, dài 110 cm. */
function hd210(overrides: Record<string, unknown> = {}) {
  return {
    id: 'VEHICLE-002',
    name: '',
    innerLengthCm: 720,
    innerWidthCm: 235,
    innerHeightCm: 240,
    maxPayloadKg: Number.NaN,
    doorWidthCm: 225,
    doorHeightCm: 230,
    clearanceCm: 0,
    obstacles: [
      { id: 'OBS-001', type: 'WHEEL_ARCH', xCm: 420, yCm: 0, zCm: 0, lengthCm: 110, widthCm: 25, heightCm: 32, loadBearing: false, maxTopLoadKg: null },
      { id: 'OBS-002', type: 'WHEEL_ARCH', xCm: 420, yCm: 210, zCm: 0, lengthCm: 110, widthCm: 25, heightCm: 32, loadBearing: false, maxTopLoadKg: null },
    ],
    axles: [],
    ...overrides,
  }
}

describe('previewVehicle', () => {
  test('keeps the geometry and ignores fields the preview does not draw', () => {
    // Tên trống và tải trọng chưa nhập (NaN) không chặn hình
    const vehicle = previewVehicle(hd210())
    expect(vehicle?.innerLengthCm).toBe(720)
    expect(vehicle?.obstacles.map((o) => o.id)).toEqual(['OBS-001', 'OBS-002'])
  })

  test('an empty number field is not a picture', () => {
    expect(previewVehicle(hd210({ innerLengthCm: Number.NaN }))).toBeNull()
  })

  test('typing 600 into the length: 6 and 60 leave the wheel arches (ending at 530 cm) outside, 600 fits', () => {
    expect(previewVehicle(hd210({ innerLengthCm: 6 }))).toBeNull()
    expect(previewVehicle(hd210({ innerLengthCm: 60 }))).toBeNull()
    expect(previewVehicle(hd210({ innerLengthCm: 600 }))?.innerLengthCm).toBe(600)
  })

  test('a door wider than the cargo space is not a picture', () => {
    expect(previewVehicle(hd210({ doorWidthCm: 250 }))).toBeNull()
  })

  test('declared axles are drawn at their typed position; name and loads being typed do not hold the picture back', () => {
    const vehicle = previewVehicle(hd210({ axles: [
      { id: 'AX-1', name: ' Trục trước ', positionXCm: -100.04, emptyLoadKg: Number.NaN, maxLoadKg: Number.NaN },
      { id: 'AX-2', name: '', positionXCm: 475, emptyLoadKg: 3200, maxLoadKg: 10000 },
    ] }))
    expect(vehicle?.axles?.map(({ id, name, positionXCm }) => ({ id, name, positionXCm }))).toStrictEqual([
      { id: 'AX-1', name: 'Trục trước', positionXCm: -100 },
      { id: 'AX-2', name: '', positionXCm: 475 },
    ])
  })

  test('no axle rows means no axles, so the model draws illustrative wheels', () => {
    expect(previewVehicle(hd210())).not.toHaveProperty('axles')
  })

  test('an axle row whose position is still empty keeps the last picture', () => {
    expect(previewVehicle(hd210({ axles: [{ id: 'AX-1', name: '', positionXCm: Number.NaN }] }))).toBeNull()
  })
})

describe('previewFacts', () => {
  test('reads payload and clearance as typed', () => {
    expect(previewFacts({ maxPayloadKg: 9500, clearanceCm: 2.5 })).toStrictEqual({ payloadKg: 9500, clearanceCm: 2.5 })
  })

  test('an empty or non-positive payload and a negative clearance are not numbers to show', () => {
    expect(previewFacts({ maxPayloadKg: Number.NaN, clearanceCm: -1 })).toStrictEqual({ payloadKg: null, clearanceCm: null })
    expect(previewFacts({ maxPayloadKg: 0, clearanceCm: 0 })).toStrictEqual({ payloadKg: null, clearanceCm: 0 })
  })

  test('unchanged facts return the same object', () => {
    const facts = previewFacts({ maxPayloadKg: 9500, clearanceCm: 0 })
    expect(nextFacts(facts, previewFacts({ maxPayloadKg: 9500, clearanceCm: 0 }))).toBe(facts)
    expect(nextFacts(facts, previewFacts({ maxPayloadKg: 9000, clearanceCm: 0 }))).not.toBe(facts)
  })
})

describe('passableOpening', () => {
  const door = { doorWidthCm: 225, doorHeightCm: 230 }

  test('the largest package through the door is the door minus the clearance', () => {
    // Luật cửa của domain: cạnh kiện + khoảng hở ≤ cạnh cửa
    expect(passableOpening(door, 2.5)).toStrictEqual({ widthCm: 222.5, heightCm: 227.5 })
  })

  test('no clearance, or a clearance that lets nothing through, has nothing to add', () => {
    expect(passableOpening(door, 0)).toBeNull()
    expect(passableOpening(door, null)).toBeNull()
    expect(passableOpening(door, 225)).toBeNull()
  })
})

describe('nextPreview', () => {
  const start = nextPreview(EMPTY_PREVIEW, previewVehicle(hd210()))

  test('an invalid value keeps the last valid picture and marks it pending', () => {
    const next = nextPreview(start, null)
    expect(next.vehicle).toBe(start.vehicle)
    expect(next.frame).toBe(start.frame)
    expect(next.pending).toBe(true)
  })

  test('the same geometry returns the same state object', () => {
    expect(nextPreview(start, previewVehicle(hd210({ name: 'Xe mới' })))).toBe(start)
  })

  test('moving an obstacle changes the picture but not the camera frame', () => {
    const moved = hd210()
    moved.obstacles[0]!.xCm = 300
    const next = nextPreview(nextPreview(start, null), previewVehicle(moved))
    expect(next.vehicle).not.toBe(start.vehicle)
    expect(next.vehicle?.obstacles[0]?.xCm).toBe(300)
    expect(next.frame).toBe(start.frame)
    expect(next.pending).toBe(false)
  })

  test('a new cargo length re-frames the camera', () => {
    const next = nextPreview(start, previewVehicle(hd210({ innerLengthCm: 600 })))
    expect(next.frame).not.toBe(start.frame)
    expect(next.frame?.innerLengthCm).toBe(600)
  })

  test('a door change within the same cargo space keeps the frame', () => {
    const next = nextPreview(start, previewVehicle(hd210({ doorWidthCm: 200 })))
    expect(next.vehicle?.doorWidthCm).toBe(200)
    expect(next.frame).toBe(start.frame)
  })
})
