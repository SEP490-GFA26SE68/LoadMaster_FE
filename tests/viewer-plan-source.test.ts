import { expect, test } from 'vitest'
import { approvePlanRevision, fetchPlanApproval, fetchPlanSource } from '@/features/viewer3d/viewer-api'

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
  expect(await fetchPlanApproval('REV-002')).toStrictEqual({ approvedByName: 'Nguyễn Thanh Tùng' })
  expect(await fetchPlanApproval('REV-001')).toStrictEqual({ approvedByName: null })
  // Kho của test chưa đăng nhập: bản duyệt mới không có người duyệt, thanh trên chỉ ghi "Đã duyệt lúc"
  const approved = await approvePlanRevision('REV-001', [])
  expect(approved.approvedAt).toBeDefined()
  expect(await fetchPlanApproval(approved.id)).toStrictEqual({ approvedByName: null })
})
