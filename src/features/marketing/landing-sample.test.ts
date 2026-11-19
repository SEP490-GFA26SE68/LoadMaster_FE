import { expect, test } from 'vitest'
import { runMockOptimization } from '@/services/optimization'
import { LANDING_REQUEST, LANDING_STOP_COUNT } from './landing-sample.mock'

/**
 * Khung 3D của trang giới thiệu hiện số của lần chạy thật trên trình duyệt; test giữ cho chuyến mẫu luôn xếp hết, đủ bốn vùng theo điểm
 * giao và không có số nào khác trang nói (kiện, điểm giao). Đổi bộ tối ưu mà chuyến mẫu không còn xếp hết thì trang phải đổi theo.
 */
test('the landing sample trip packs every package into one zone per stop, with nothing left out', () => {
  const result = runMockOptimization(LANDING_REQUEST, { clock: () => 0 })
  const total = LANDING_REQUEST.packages.reduce((sum, line) => sum + line.quantity, 0)

  expect(result.status).toBe('COMPLETED')
  expect(result.isMockResult).toBe(true)
  expect(total).toBe(366)
  expect(result.metrics.placedCount).toBe(total)
  expect(result.unplacedPackages).toEqual([])
  // Khung 3D ghi số này cạnh câu "hàng của điểm cuối nằm sâu nhất": mọi kiện nằm đúng vùng của điểm giao mình
  expect(result.metrics.rehandlingCount).toBe(0)
  expect(result.stopZones?.map((zone) => zone.stopId)).toEqual([1, 2, 3, 4])
  expect(new Set(LANDING_REQUEST.packages.map((line) => line.deliveryStop)).size).toBe(LANDING_STOP_COUNT)
  // Mã kiện có thể lọt vào DOM qua nhãn của khung 3D: không chữ có dấu (bản tiếng Anh)
  for (const line of LANDING_REQUEST.packages) expect(line.name).toMatch(/^[\x20-\x7e]+$/)
})

/** Thẻ chuyến ghi "Thùng 6 m" và bốn điểm giao; cảnh sân kho dựng thùng dài 6 m và bốn làn chờ: chuyến mẫu phải đúng như vậy. */
test('the landing sample trip runs on the 6 m truck with the four stops the page names', () => {
  expect(LANDING_REQUEST.vehicle.innerLengthCm).toBe(600)
  expect(new Set(LANDING_REQUEST.packages.map((line) => line.deliveryStop)).size).toBe(4)
})
