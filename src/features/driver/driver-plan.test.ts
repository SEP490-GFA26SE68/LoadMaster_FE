import { expect, test } from 'vitest'
import type { PackagePlacement } from '@/domain/models'
import { adaptResult } from '@/features/viewer3d/scene-input'
import type { DeliveryStop } from '@/lib/mock-db'
import { twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'
import { stopDeliveries } from './driver-plan'

test('điểm giao lấy tên, địa chỉ từ chuyến (số = vị trí + 1); kiện của điểm theo unloadingOrder của kết quả', () => {
  const result = twoCartonResult()
  // Ba kiện điểm 1 với unloadingOrder không trùng thứ tự placement lẫn thứ tự mã
  const extra = (id: string, xCm: number, zCm: number, unloadingOrder: number): PackagePlacement =>
    ({ ...result.placements[1]!, packageInstanceId: id, xCm, zCm, unloadingOrder })
  const request = twoCartonRequest()
  request.packages = [request.packages[0]!, { ...request.packages[1]!, quantity: 3 }]
  result.placements = [
    result.placements[0]!,
    extra('PKG-002-01', 240, 0, 3),
    extra('PKG-002-02', 480, 0, 1),
    extra('PKG-002-03', 240, 200, 2),
  ]
  const source = twoCartonTrip()
  const model = adaptResult({ trip: { id: 'TRIP-001', stops: source.stops }, revision: { request, result, ordersRecomputed: true } })

  const stops = stopDeliveries(source.stops, model)

  expect(stops.map(({ number, name, address }) => ({ number, name, address }))).toStrictEqual(
    source.stops.map(({ name, address }, index) => ({ number: index + 1, name, address })),
  )
  expect(stops[0]!.items.map((item) => [item.id, item.unloadingOrder])).toStrictEqual([
    ['PKG-002-02', 1], ['PKG-002-03', 2], ['PKG-002-01', 3],
  ])
  expect(stops[1]!.items).toStrictEqual([])
  expect(stops[2]!.items.map((item) => item.id)).toStrictEqual(['PKG-001-01'])
  // Carton A 120 × 60 × 45 cm, 30 kg; thùng 600 × 250 cm: tâm x 540 gần cửa, 300 giữa, 180 sát vách trước
  expect(stops[0]!.items.map(({ area, layer }) => [area, layer])).toStrictEqual([['door', 'floor'], ['middle', 'upper'], ['middle', 'floor']])
  expect(stops[2]!.items[0]).toMatchObject({ packageId: 'PKG-001', name: 'Carton A', weightKg: 30, area: 'front', layer: 'floor' })
})

test('lớp: trên sàn, lớp dưới khi tâm thấp hơn nửa chiều cao thùng, còn lại lớp trên', () => {
  const request = twoCartonRequest()
  const result = twoCartonResult()
  result.placements = [{ ...result.placements[0]!, zCm: 45 }, { ...result.placements[1]!, zCm: 102.5 }]
  const source = twoCartonTrip()
  const model = adaptResult({ trip: { id: 'TRIP-001', stops: source.stops }, revision: { request, result, ordersRecomputed: true } })
  const stops = stopDeliveries(source.stops, model)
  // Tâm z: 45 + 22,5 = 67,5 < 125 → lớp dưới; 102,5 + 22,5 = 125 = nửa chiều cao → lớp trên
  expect(stops[2]!.items[0]!.layer).toBe('lower')
  expect(stops[0]!.items[0]!.layer).toBe('upper')
})

test('chuyến đã chèn điểm nhận dọc đường: kiện của phương án nằm ở đúng điểm theo số điểm hiện tại, điểm chèn không có kiện nào của phương án', () => {
  const source = twoCartonTrip()
  const [first, second, third] = source.stops as [DeliveryStop, DeliveryStop, DeliveryStop]
  // Điểm nhận chèn giữa điểm 1 và điểm 2: điểm 2 và 3 của phương án thành điểm 3 và 4
  const stops: DeliveryStop[] = [
    { ...first, planNumber: 1 },
    { id: 'STOP-NHAN', name: 'Xưởng may', address: 'KCN VSIP 1', kind: 'PICKUP', planNumber: null },
    { ...second, planNumber: 2 },
    { ...third, planNumber: 3 },
  ]
  const model = adaptResult({ trip: { id: 'TRIP-001', stops }, revision: { request: twoCartonRequest(), result: twoCartonResult(), ordersRecomputed: true } })
  const byStop = stopDeliveries(stops, model).map((stop) => stop.items.map((item) => item.id))
  const before = stopDeliveries(source.stops, adaptResult({ trip: { id: 'TRIP-001', stops: source.stops }, revision: { request: twoCartonRequest(), result: twoCartonResult(), ordersRecomputed: true } })).map((stop) => stop.items.map((item) => item.id))
  expect(byStop).toStrictEqual([before[0], [], before[1], before[2]])
  expect(model.stops.map((stop) => stop.number)).toStrictEqual([1, 2, 3, 4])
})
