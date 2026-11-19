import { expect, test } from 'vitest'
import { CARGO, CHAPTERS, journeyState, TRUCK_ZONES, truckBoxes } from './journey-model'

/**
 * Hình thùng xe của "Một chuyến hàng": kiện nằm trong lòng thùng và trong vùng của điểm giao mình, không chồng nhau; xếp theo thứ tự
 * giao ngược (điểm cuối vào trước, từ sàn lên) và dỡ theo thứ tự giao (điểm 1 ra trước, từ trên xuống), mỗi việc trong đúng khoảng tiến
 * độ của chặng của nó; tiến độ cuộn của năm chặng.
 */
const boxes = truckBoxes()

test('35 boxes, each inside the cargo body and inside the zone of its own stop, none overlapping', () => {
  expect(boxes).toHaveLength(35)
  expect(new Set(boxes.map((box) => box.id)).size).toBe(35)
  expect(TRUCK_ZONES.map((zone) => zone.stop)).toStrictEqual([4, 3, 2, 1])
  for (const box of boxes) {
    const zone = TRUCK_ZONES.find((candidate) => candidate.stop === box.stop)
    if (!zone) throw new Error(`Kiện ${box.id} không có vùng`)
    expect(box.x).toBeGreaterThanOrEqual(zone.x)
    expect(box.x + box.width).toBeLessThanOrEqual(zone.x + zone.width)
    expect(box.y).toBeGreaterThanOrEqual(CARGO.y)
    expect(box.y + box.height).toBeLessThanOrEqual(CARGO.y + CARGO.height)
  }
  for (const [index, a] of boxes.entries()) {
    for (const b of boxes.slice(index + 1)) {
      const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y
      expect(apart, `${a.id} chồng lên ${b.id}`).toBe(true)
    }
  }
})

test('loading puts the last stop in first, floor up; unloading takes stop 1 out first, top down', () => {
  const byOn = [...boxes].sort((a, b) => a.on - b.on)
  const byOff = [...boxes].sort((a, b) => a.off - b.off)
  expect([...new Set(byOn.map((box) => box.stop))]).toStrictEqual([4, 3, 2, 1])
  expect([...new Set(byOff.map((box) => box.stop))]).toStrictEqual([1, 2, 3, 4])
  // Cùng một cột (cùng x): kiện thấp hơn (y lớn hơn) lên xe trước và xuống xe sau
  for (const a of boxes) {
    for (const b of boxes) {
      if (a.x !== b.x || a.y <= b.y) continue
      expect(a.on, `${a.id} lên trước ${b.id}`).toBeLessThan(b.on)
      expect(a.off, `${a.id} xuống sau ${b.id}`).toBeGreaterThan(b.off)
    }
  }
})

test('every box loads within the warehouse leg and unloads within the stop leg; at the default progress of 0.5 the truck is full', () => {
  const legs = CHAPTERS.length
  for (const box of boxes) {
    // Chặng 2 (kho) là [0,2; 0,4), chặng 4 (điểm giao) là [0,6; 0,8)
    expect(box.on).toBeGreaterThanOrEqual(1 / legs)
    expect(box.on).toBeLessThan(2 / legs)
    expect(box.off).toBeGreaterThanOrEqual(3 / legs)
    expect(box.off).toBeLessThan(4 / legs)
  }
  // journey.css đặt --p mặc định 0,5 (không JavaScript, không IntersectionObserver): mọi kiện đã lên xe, chưa kiện nào xuống
  expect(boxes.every((box) => box.on <= 0.5 && box.off > 0.5)).toBe(true)
})

test('progress follows the last leg whose top has passed the anchor; each leg is one fifth whatever its height', () => {
  const legs = [100, 300, 500, 700, 900].map((top) => ({ top, height: 200 }))
  expect(journeyState([], 400)).toStrictEqual({ p: 0, chapter: 0 })
  expect(journeyState(legs, 50)).toStrictEqual({ p: 0, chapter: 0 })
  expect(journeyState(legs, 200)).toStrictEqual({ p: 0.1, chapter: 0 })
  expect(journeyState(legs, 650)).toStrictEqual({ p: 0.55, chapter: 2 })
  expect(journeyState(legs, 5000)).toStrictEqual({ p: 1, chapter: 4 })
  // Giảm chuyển động: giữa chặng đang xem, không theo từng điểm cuộn
  expect(journeyState(legs, 650, true)).toStrictEqual({ p: 0.5, chapter: 2 })
  expect(journeyState(legs, 50, true)).toStrictEqual({ p: 0.1, chapter: 0 })
})
