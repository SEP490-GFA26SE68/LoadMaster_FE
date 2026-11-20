import { expect, test } from 'vitest'
import { bestCandidates } from '@/lib/candidate-metrics'
import { runMockCandidates } from '@/services/optimization'
import { DEFAULT_OBJECTIVE, firstStopFacts, landingPlans } from './landing-plans'
import { LANDING_REQUEST, LANDING_STOP_COUNT } from './landing-sample.mock'

const run = runMockCandidates(LANDING_REQUEST, { clock: () => 0 })
const plans = landingPlans(LANDING_REQUEST, run.plans)
const total = LANDING_REQUEST.packages.reduce((sum, line) => sum + line.quantity, 0)
const resultOf = (objective: string) => run.plans.find((plan) => plan.objective === objective)!.result

/**
 * Khung 3D của trang giới thiệu hiện số của lần chạy thật trên trình duyệt: một lần chạy, ba phương án A · B · C. Test giữ cho chuyến
 * mẫu luôn xếp hết ở cả ba phương án, đủ bốn vùng theo điểm giao, và cho phương án C (vẽ khi mở trang) mọi kiện nằm đúng vùng. Đổi bộ tối
 * ưu mà chuyến mẫu không còn như vậy thì trang phải đổi theo.
 */
test('one run gives three plans that each pack every package into one zone per stop', () => {
  expect(total).toBe(366)
  expect(plans.map((plan) => plan.id)).toEqual(['A', 'B', 'C'])
  for (const { result } of run.plans) {
    expect(result.status).toBe('COMPLETED')
    expect(result.isMockResult).toBe(true)
    expect(result.metrics.placedCount).toBe(total)
    expect(result.unplacedPackages).toEqual([])
    expect(result.stopZones?.map((zone) => zone.stopId)).toEqual([1, 2, 3, 4])
  }
  // Khung 3D vẽ C khi mở trang, cạnh câu "hàng của điểm cuối nằm sâu nhất": mọi kiện nằm đúng vùng của điểm giao mình
  const shown = plans.find((plan) => plan.objective === DEFAULT_OBJECTIVE)!
  expect(shown.id).toBe('C')
  expect(shown.rehandlingCount).toBe(0)
  expect(new Set(LANDING_REQUEST.packages.map((line) => line.deliveryStop)).size).toBe(LANDING_STOP_COUNT)
  // Mã kiện có thể lọt vào DOM qua nhãn của khung 3D: không chữ có dấu (bản tiếng Anh)
  for (const line of LANDING_REQUEST.packages) expect(line.name).toMatch(/^[\x20-\x7e]+$/)
})

/**
 * Bộ chọn hiện đúng những gì lần chạy cho ra: ba cách xếp khác nhau, tải trục tính được (xe mẫu khai hai trục) và "Tốt nhất" chỉ ở chỉ
 * số mà các phương án khác nhau. Số ở đây là của bộ tối ưu mô phỏng hiện tại; đổi bộ tối ưu thì cập nhật cùng lúc với trang.
 */
test('the three plans really differ: B balances the axles best, C needs no rehandling; volume and unplaced tie', () => {
  const layouts = new Set(run.plans.map(({ result }) => JSON.stringify(result.placements.map((p) => [p.packageInstanceId, p.xCm, p.yCm, p.zCm]))))
  expect(layouts.size).toBe(3)
  for (const plan of plans) expect(plan.axles.status).toBe('computed')
  const best = bestCandidates(plans)
  expect([...(best.axleGap ?? [])]).toEqual(['B'])
  expect([...(best.rehandling ?? [])]).toEqual(['C'])
  expect(best.volume).toBeUndefined()
  expect(best.unplaced).toBeUndefined()
})

test('stop 1 facts are read from each plan: 96 boxes, none in the way; only C keeps other stops out of the stop-1 zone', () => {
  const facts = Object.fromEntries(plans.map((plan) => [plan.id, plan.firstStop]))
  expect(facts.A).toEqual({ count: 96, moved: 0, outOfZone: { foreign: 16, stray: 0 } })
  expect(facts.B).toEqual({ count: 96, moved: 0, outOfZone: { foreign: 48, stray: 0 } })
  expect(facts.C).toEqual({ count: 96, moved: 0, outOfZone: { foreign: 0, stray: 0 } })
  expect(firstStopFacts(LANDING_REQUEST, { ...resultOf('MIN_REHANDLING'), stopZones: undefined }).outOfZone).toBeNull()
})

test('a stop-1 box moved deep into the truck is out of its zone, and the later-stop boxes between it and the door must be moved', () => {
  const c = resultOf('MIN_REHANDLING')
  const target = c.placements.find((p) => p.packageInstanceId.startsWith('SKU-A'))!
  const deep = c.placements.find((p) => p.packageInstanceId.startsWith('SKU-D') && p.xCm === 0 && p.zCm === 0)!
  // Đổi chỗ một kiện của điểm 1 với một kiện sát vách trước của điểm 4 (cùng đáy 40 × 30 không vừa — chỉ hoán vị toạ độ góc)
  const swapped = c.placements.map((p) => p === target ? { ...p, xCm: deep.xCm, yCm: deep.yCm, zCm: deep.zCm }
    : p === deep ? { ...p, xCm: target.xCm, yCm: target.yCm, zCm: target.zCm } : p)
  const facts = firstStopFacts(LANDING_REQUEST, { ...c, placements: swapped })
  expect(facts.outOfZone).toEqual({ foreign: 1, stray: 1 })
  expect(facts.moved).toBeGreaterThan(0)
})

/** Thẻ chuyến ghi "Thùng 6 m" và bốn điểm giao; cảnh sân kho dựng thùng dài 6 m và bốn làn chờ: chuyến mẫu phải đúng như vậy. */
test('the landing sample trip runs on the 6 m truck with the four stops the page names, on the two axles of the 6 m seed truck', () => {
  expect(LANDING_REQUEST.vehicle.innerLengthCm).toBe(600)
  expect(new Set(LANDING_REQUEST.packages.map((line) => line.deliveryStop)).size).toBe(4)
  expect(LANDING_REQUEST.vehicle.axles?.map((axle) => axle.positionXCm)).toEqual([-100, 400])
})
