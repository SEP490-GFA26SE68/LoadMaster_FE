import { expect, test } from 'vitest'
import { SPEC_CARTON_A_PLACEMENT } from '@/domain/fixtures/spec-samples'
import { twoCartonRequest, twoCartonResult } from '@/test/mock-db-samples'
import { revisionThumbnail } from './revision-thumbnail'

// Màu điểm giao Okabe–Ito (AGENTS.md mục 4): điểm 1 #E69F00, điểm 3 #009E73.

test('khối lấy từ placement thật, cm đổi sang m, màu theo điểm giao của kiện gốc', () => {
  const thumbnail = revisionThumbnail(twoCartonRequest(), twoCartonResult().placements)

  // Truck 6m: 600 × 240 × 250 cm.
  expect(thumbnail.container).toEqual({ length: 6, width: 2.4, height: 2.5 })
  expect(thumbnail.placedCount).toBe(2)
  expect(thumbnail.boxes).toEqual([
    // PKG-001-01 giao điểm 3, x 120 cm, 120 × 60 × 45 cm.
    { x: 1.2, y: 0, z: 0, length: 1.2, width: 0.6, height: 0.45, color: '#009E73' },
    // PKG-002-01 giao điểm 1, x 240 cm.
    { x: 2.4, y: 0, z: 0, length: 1.2, width: 0.6, height: 0.45, color: '#E69F00' },
  ])
})

test('vượt trần thì giữ khối có góc xa gốc nhất (gần người nhìn), bỏ placement không khớp kiện', () => {
  const stray = { ...SPEC_CARTON_A_PLACEMENT, packageInstanceId: 'PKG-404-01', xCm: 480 }
  const thumbnail = revisionThumbnail(twoCartonRequest(), [...twoCartonResult().placements, stray], 1)

  // Góc xa: PKG-001-01 1,2 + 1,2 + 0,6 + 0,45 = 3,45; PKG-002-01 2,4 + 1,2 + 0,6 + 0,45 = 4,65 → giữ PKG-002-01.
  expect(thumbnail.boxes).toEqual([{ x: 2.4, y: 0, z: 0, length: 1.2, width: 0.6, height: 0.45, color: '#E69F00' }])
  expect(thumbnail.placedCount).toBe(3)
})
