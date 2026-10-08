import { expect, test } from 'vitest'
import { adaptResult } from '@/features/viewer3d/scene-input'
import { withPickupPlacements } from '@/features/viewer3d/scene-pickups'
import { createMockDb, type PickupPackage } from '@/lib/mock-db'
import { pickupSceneItems, unplacedPickups } from './driver-pickups'

/**
 * Kiện nhận dọc đường trong khung 3D của tài xế (FE-BL-01): kiện có chỗ vào scene cùng kiện của phương án, kiện chưa có chỗ nêu lý do.
 * `TRIP-009`: điểm 1 đã giao xong nên vùng X 393,1–610 trống; điểm giao của yêu cầu dùng lại điểm 3 nên thành điểm 4 sau khi chèn điểm nhận.
 * jsdom không dựng WebGL nên kiểm scene, không kiểm khung vẽ.
 */
const TRIP = 'TRIP-009'
const NOW = new Date('2026-09-14T05:00:00.000Z')
const BOX: PickupPackage = { packageCode: 'HG-0601', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD' }

async function approve(packages: PickupPackage[]) {
  const db = createMockDb({ now: () => NOW })
  db.restoreSession('US-0001')
  const request = await db.createPickupRequest(TRIP, {
    pickup: { name: 'Xưởng may Hoàng Gia', address: 'Đường số 4, KCN VSIP 1, Thuận An', lat: 10.928, lng: 106.712 },
    delivery: { name: 'Bếp ăn KCN Sóng Thần', address: '12 Đường số 6, KCN Sóng Thần 1, Dĩ An', lat: 10.893, lng: 106.75 },
    packages,
  })
  const { packages: created } = await db.approvePickupRequest(TRIP, request.id, { overrideReason: 'Khách quen' })
  const trip = await db.getTrip(TRIP)
  const plan = (await db.listRevisions(TRIP)).find((revision) => revision.id === trip.loading?.revisionId)
  if (!plan) throw new Error('chuyến phải có phương án đang làm theo')
  const facts = { requests: await db.listPickupRequests(TRIP), packages: await db.listPickupPackages(TRIP) }
  return { trip, plan, facts, created }
}

test('a pickup package with a place joins the scene at that place, in the colour of its delivery stop, and is not listed as without a place', async () => {
  const { trip, plan, facts, created } = await approve([BOX])
  const planModel = adaptResult({ trip, revision: plan })
  const model = withPickupPlacements(planModel, pickupSceneItems(trip.stops, facts))
  expect(model.placements).toHaveLength(planModel.placements.length + 1)
  const pickup = model.placements.find((placement) => placement.id === created[0]?.id)
  expect(pickup).toMatchObject({
    name: 'HG-0601', stop: 4, position: { x: 393.1, y: 25, z: 0 }, orientation: 'LWH', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12,
  })
  expect(pickup && model.placementById.get(pickup.id)).toBe(pickup)
  expect(model.baseDimensionsById.get(created[0]?.id ?? '')).toStrictEqual({ lengthCm: 60, widthCm: 40, heightCm: 40 })
  expect(model.stops[3]?.packageCount).toBe((planModel.stops[3]?.packageCount ?? 0) + 1)
  // Thứ tự dỡ nối sau kiện của phương án, để màn dỡ phát được cả hai
  expect(pickup?.unloadingOrder).toBe(Math.max(...planModel.placements.map((placement) => placement.unloadingOrder)) + 1)
  expect(unplacedPickups(facts)).toStrictEqual([])
})

test('a pickup package that did not fit has no place in the scene and is listed with its reason', async () => {
  const { trip, plan, facts, created } = await approve([{ ...BOX, packageCode: 'HG-0602', lengthCm: 300, widthCm: 150, weightKg: 20 }])
  const planModel = adaptResult({ trip, revision: plan })
  expect(pickupSceneItems(trip.stops, facts)).toStrictEqual([])
  expect(withPickupPlacements(planModel, [])).toBe(planModel)
  expect(unplacedPickups(facts)).toStrictEqual([{ id: created[0]?.id, name: 'HG-0602', weightKg: 20, reasonCode: 'NO_SPACE' }])
})
