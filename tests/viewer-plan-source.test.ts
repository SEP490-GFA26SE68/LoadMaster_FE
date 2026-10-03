import { expect, test } from 'vitest'
import { approveLoadPlan, fetchPlanApproval, fetchPlanSource } from '@/features/viewer3d/viewer-api'
import { getMockDb } from '@/lib/mock-db'
import { optimizedTwoCartonTrip } from '@/test/mock-db-samples'

const TRIP_ID = 'TRIP-2026-0914'

/** Seed: REV-001 là kết quả tối ưu, REV-002 là bản đã duyệt từ REV-001 (cùng `jobId`). */
test('the Planner opens the approved revision by default, by job, and the exact revision by id', async () => {
  const byDefault = await fetchPlanSource(TRIP_ID)
  expect(byDefault.revision?.approvedAt).toBeDefined()
  const approved = byDefault.revision!

  expect((await fetchPlanSource(TRIP_ID, approved.jobId)).revision?.id).toBe(approved.id)
  const source = await fetchPlanSource(TRIP_ID, 'REV-001')
  expect(source.revision?.id).toBe('REV-001')
  expect(source.revision?.approvedAt).toBeUndefined()
  expect((await fetchPlanSource(TRIP_ID, 'KHONG-CO')).revision).toBeUndefined()
})

/** "Duyệt bởi <tên>" ở thanh trên Planner: kho ghi người bấm Duyệt vào revision đã duyệt (`approvedBy`). */
test('the Planner names who approved an approved revision; an unapproved one, or one approved without a session, has no name', async () => {
  // Seed: điều phối viên demo duyệt mọi phương án (FE-0-07)
  expect((await fetchPlanApproval('REV-002')).approvedByName).toBe('Nguyễn Thanh Tùng')
  expect((await fetchPlanApproval('REV-001')).approvedByName).toBeNull()
  // Kho của test chưa đăng nhập: bản duyệt mới không có người duyệt, thanh trên chỉ ghi "Đã duyệt lúc"
  const approved = await approveLoadPlan('REV-001', [])
  expect(approved.approvedAt).toBeDefined()
  expect((await fetchPlanApproval(approved.id)).approvedByName).toBeNull()
})

/** Nhãn phương án ứng viên ở thanh trên Planner và đích của nút So sánh (FE-5b-06). */
test('a candidate of a three-plan run, and the approved copy made from it, carry the run and the letter of their objective; a single-plan run has none', async () => {
  // Seed: RUN-002 của chuyến mẫu ra REV-001-A (tối đa thể tích), REV-001-B (cân bằng tải trục), REV-001 (ít dỡ-xếp lại); REV-002 duyệt từ REV-001
  expect((await fetchPlanApproval('REV-001-A')).candidate).toStrictEqual({ runId: 'RUN-002', label: 'A' })
  expect((await fetchPlanApproval('REV-001-B')).candidate).toStrictEqual({ runId: 'RUN-002', label: 'B' })
  expect((await fetchPlanApproval('REV-001')).candidate).toStrictEqual({ runId: 'RUN-002', label: 'C' })
  expect((await fetchPlanApproval('REV-002')).candidate).toStrictEqual({ runId: 'RUN-002', label: 'C' })
  // Lưu một kết quả lẻ là lần chạy một phương án: không có nhãn, nút So sánh mở ma trận mọi revision
  const { revision } = await optimizedTwoCartonTrip(getMockDb())
  expect(await fetchPlanApproval(revision.id)).toStrictEqual({ approvedByName: null, candidate: null })
})
