import { expect, test } from 'vitest'
import { createTranslator } from '@/lib/i18n'
import { plannerAccess } from './approval/planner-access'
import { ANY_VEHICLE, canDecide, DEFAULT_DECISION, decisionInput, decisionSchema } from './plan-decision'

/** Thanh quyết định của quản lý công ty trong Planner (LM-104): khi nào hiện, lý do bắt buộc, lệnh gửi kho. */

const pending = plannerAccess({ canApprove: true, approvedAt: null, hasEdits: false })

test('decisions show only for an unedited plan still in the approval queue, to an account that reviews plans', () => {
  expect(canDecide({ access: pending, reviewable: true, canReview: true })).toBe(true)
  expect(canDecide({ access: pending, reviewable: false, canReview: true })).toBe(false)
  expect(canDecide({ access: pending, reviewable: true, canReview: false })).toBe(false)
  const edited = plannerAccess({ canApprove: true, approvedAt: null, hasEdits: true })
  expect(canDecide({ access: edited, reviewable: true, canReview: true })).toBe(false)
})

test('the reason is required and trimmed; at most 500 characters', () => {
  const schema = decisionSchema(createTranslator('vi'))
  expect(schema.safeParse({ ...DEFAULT_DECISION, reason: '   ' }).error?.issues[0]?.message).toBe('Nhập lý do.')
  expect(schema.safeParse({ ...DEFAULT_DECISION, reason: 'x'.repeat(501) }).success).toBe(false)
  expect(schema.parse({ ...DEFAULT_DECISION, reason: '  Xe quá tải phía sau  ' }).reason).toBe('Xe quá tải phía sau')
})

test('reject and re-optimize send the reason; a suggestion sends its kind, the note and a vehicle only when one was chosen', () => {
  expect(decisionInput('reject', 'REV-009', { ...DEFAULT_DECISION, reason: 'Sai xe' })).toStrictEqual({ kind: 'reject', revisionId: 'REV-009', reason: 'Sai xe' })
  expect(decisionInput('reoptimize', 'REV-009', { ...DEFAULT_DECISION, reason: 'Cân bằng tải trục' }).kind).toBe('reoptimize')
  expect(decisionInput('suggest', 'REV-009', { reason: 'Dùng xe 7 tấn', suggestion: 'change_vehicle', vehicleId: 'VEHICLE-006' }))
    .toStrictEqual({ kind: 'suggest', revisionId: 'REV-009', suggestion: { kind: 'change_vehicle', note: 'Dùng xe 7 tấn', vehicleId: 'VEHICLE-006' } })
  expect(decisionInput('suggest', 'REV-009', { reason: 'Tách hai chuyến', suggestion: 'split_trip', vehicleId: 'VEHICLE-006' }))
    .toStrictEqual({ kind: 'suggest', revisionId: 'REV-009', suggestion: { kind: 'split_trip', note: 'Tách hai chuyến' } })
  expect(decisionInput('suggest', 'REV-009', { reason: 'Đổi xe', suggestion: 'change_vehicle', vehicleId: ANY_VEHICLE }))
    .toStrictEqual({ kind: 'suggest', revisionId: 'REV-009', suggestion: { kind: 'change_vehicle', note: 'Đổi xe' } })
})
