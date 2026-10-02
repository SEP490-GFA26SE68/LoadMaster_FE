import { expect, test } from 'vitest'
import type { CargoPackage } from '@/domain/models'
import { nextStopId, normalizeAddress, pruneGeneratedStops, requirementStop, stopKey, withStopDemands } from './trip-stops'
import type { DeliveryStop } from './types'

/** Điểm giao tự sinh (FE-4b-04, D-73): gộp theo địa chỉ chuẩn hoá + toạ độ, hạn sớm nhất, ưu tiên cao nhất, điểm hết kiện tự mất. */

const DI_AN = { destinationName: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An', lat: 10.896, lng: 106.789 }
const BINH_DUONG = { destinationName: 'Siêu thị Co.opmart Bình Dương', address: '30 Đại lộ Bình Dương, Thủ Dầu Một', lat: 10.979, lng: 106.673 }

const line = (id: string, deliveryStop: number): CargoPackage => ({
  id, name: id, lengthCm: 40, widthCm: 30, heightCm: 20, weightKg: 5, quantity: 1, deliveryStop, allowedOrientations: ['LWH'], keepUpright: true,
  fragilityLevel: 'NONE', stackable: true, maxTopLoadKg: 20, minSupportRatio: 0.8, priority: 1, mustLoad: false,
})

test('an address is compared without case, punctuation and extra spaces — but with its diacritics', () => {
  expect(normalizeAddress('  215 Quốc lộ 1K,  P. Đông Hoà, Dĩ An ')).toBe('215 quốc lộ 1k p đông hoà dĩ an')
  expect(normalizeAddress('215 QUỐC LỘ 1K - P.Đông Hoà; Dĩ An.')).toBe('215 quốc lộ 1k p đông hoà dĩ an')
  // "Hoà" và "Hoá" là hai chữ khác nhau: không bỏ dấu
  expect(normalizeAddress('12 Thanh Hoá')).not.toBe(normalizeAddress('12 Thanh Hoà'))
})

test('the key of a stop is its normalised address and its coordinates to five decimals; missing coordinates are their own value', () => {
  expect(stopKey({ address: '215 Quốc lộ 1K, Dĩ An', lat: 10.896, lng: 106.789 })).toBe('215 quốc lộ 1k dĩ an|10.89600|106.78900')
  expect(stopKey({ address: '215 quốc lộ 1K Dĩ An', lat: 10.8960004, lng: 106.7890001 })).toBe('215 quốc lộ 1k dĩ an|10.89600|106.78900')
  expect(stopKey({ address: '215 Quốc lộ 1K, Dĩ An' })).toBe('215 quốc lộ 1k dĩ an||')
  expect(stopKey({ address: '215 Quốc lộ 1K, Dĩ An', lat: 10.8961, lng: 106.789 })).toBe('215 quốc lộ 1k dĩ an|10.89610|106.78900')
})

test('a requirement gets a new generated stop at the end, named after its destination', () => {
  const manual: DeliveryStop = { id: 'STOP-01', name: 'Điện máy Xanh Tân An', address: '88 Hùng Vương, P. 2, Tân An, Long An' }
  const first = requirementStop([manual], DI_AN)
  expect(first).toStrictEqual({
    index: 1, created: true,
    stops: [manual, { id: 'STOP-02', name: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An', lat: 10.896, lng: 106.789, generated: true }],
  })
  // Chuyến chưa có điểm nào: điểm đầu tiên là STOP-01
  expect(requirementStop([], BINH_DUONG).stops).toStrictEqual([
    { id: 'STOP-01', name: 'Siêu thị Co.opmart Bình Dương', address: '30 Đại lộ Bình Dương, Thủ Dầu Một', lat: 10.979, lng: 106.673, generated: true },
  ])
  // Yêu cầu chưa có toạ độ: điểm sinh ra cũng không có
  expect(requirementStop([], { destinationName: 'Kho A', address: 'Q.1' }).stops).toStrictEqual([{ id: 'STOP-01', name: 'Kho A', address: 'Q.1', generated: true }])
})

test('the same address and coordinates merge into the stop already there, generated or added by hand', () => {
  const { stops } = requirementStop([], DI_AN)
  const again = requirementStop(stops, { ...DI_AN, destinationName: 'BHX Dĩ An (cửa sau)', address: '215 quốc lộ 1K,  P.Đông Hoà, Dĩ An' })
  expect([again.index, again.created, again.stops]).toStrictEqual([0, false, stops])
  // Cùng địa chỉ, khác toạ độ — hoặc một bên chưa có toạ độ: điểm khác
  expect(requirementStop(stops, { ...DI_AN, lat: 10.9 }).created).toBe(true)
  expect(requirementStop(stops, { destinationName: DI_AN.destinationName, address: DI_AN.address }).created).toBe(true)
  // Điểm thêm tay trùng địa chỉ và toạ độ cũng nhận yêu cầu, và vẫn là điểm tay
  const manual: DeliveryStop = { id: 'STOP-07', name: 'BHX Dĩ An', address: DI_AN.address, lat: 10.896, lng: 106.789, phone: '0909 318 204' }
  expect(requirementStop([manual], DI_AN)).toStrictEqual({ index: 0, created: false, stops: [manual] })
})

test('a new stop takes the number after the largest STOP-NN of the trip', () => {
  expect(nextStopId([])).toBe('STOP-01')
  expect(nextStopId([{ id: 'STOP-01' }, { id: 'STOP-04' }, { id: 'KHO-9' }])).toBe('STOP-05')
  expect(nextStopId([{ id: 'STOP-99' }])).toBe('STOP-100')
})

test('the deadline of a stop is the earliest of its requirements and its priority the highest; a stop without requirements has neither', () => {
  const stops: DeliveryStop[] = [
    { id: 'STOP-01', name: 'A', address: 'a', deadline: '2026-09-30T00:00:00.000Z', priority: 'URGENT' },
    { id: 'STOP-02', name: 'B', address: 'b', generated: true },
    { id: 'STOP-03', name: 'C', address: 'c', generated: true },
  ]
  expect(withStopDemands(stops, [
    { deliveryStop: 2, deadline: '2026-09-16T09:00:00.000Z', priority: 'NORMAL' },
    { deliveryStop: 2, deadline: '2026-09-16T04:00:00.000Z', priority: 'HIGH' },
    { deliveryStop: 2, deadline: '2026-09-17T10:00:00.000Z', priority: 'LOW' },
    { deliveryStop: 3, deadline: '2026-09-19T05:00:00.000Z', priority: 'URGENT' },
    { deliveryStop: 3, deadline: '2026-09-18T10:00:00.000Z', priority: 'LOW' },
  ])).toStrictEqual([
    // Điểm 1 không còn yêu cầu nào: hạn và ưu tiên cũ bị gỡ
    { id: 'STOP-01', name: 'A', address: 'a' },
    { id: 'STOP-02', name: 'B', address: 'b', generated: true, deadline: '2026-09-16T04:00:00.000Z', priority: 'HIGH' },
    { id: 'STOP-03', name: 'C', address: 'c', generated: true, deadline: '2026-09-18T10:00:00.000Z', priority: 'URGENT' },
  ])
})

test('a generated stop without packages disappears and later stops renumber; a stop added by hand stays', () => {
  const stops: DeliveryStop[] = [
    { id: 'STOP-01', name: 'Tay, không kiện', address: 'a' },
    { id: 'STOP-02', name: 'Tự sinh, không kiện', address: 'b', generated: true },
    { id: 'STOP-03', name: 'Tự sinh, còn kiện', address: 'c', generated: true },
    { id: 'STOP-04', name: 'Tự sinh, không kiện', address: 'd', generated: true },
    { id: 'STOP-05', name: 'Tay, còn kiện', address: 'e' },
  ]
  const packages = [line('PKG-001', 3), line('PKG-002', 5), line('PKG-003', 3)]
  const pruned = pruneGeneratedStops(stops, packages)
  expect(pruned.stops.map((stop) => stop.id)).toStrictEqual(['STOP-01', 'STOP-03', 'STOP-05'])
  expect(pruned.packages.map((pkg) => [pkg.id, pkg.deliveryStop])).toStrictEqual([['PKG-001', 2], ['PKG-002', 3], ['PKG-003', 2]])
  // Không điểm nào phải bỏ: trả lại chính hai mảng cũ
  const kept = pruneGeneratedStops(pruned.stops, pruned.packages)
  expect([kept.stops === pruned.stops, kept.packages === pruned.packages]).toStrictEqual([true, true])
})
