import { expect, test } from 'vitest'
import { plannerAccess } from './planner-access'

/** Nút Duyệt, chỗ "Đã duyệt lúc …" và khoá chỉnh sửa của Planner (LM-094, D-45, D-51). */

const APPROVED_AT = '2026-09-14T02:00:00.000Z'

test('an approved revision without edits has no Approve button and shows when it was approved', () => {
  expect(plannerAccess({ canApprove: true, approvedAt: APPROVED_AT, hasEdits: false }))
    .toStrictEqual({ lock: null, approve: null, approvedAt: APPROVED_AT })
})

test('edits on any revision offer "Approve edits"; an unapproved revision without edits offers "Approve plan"', () => {
  expect(plannerAccess({ canApprove: true, approvedAt: APPROVED_AT, hasEdits: true }))
    .toStrictEqual({ lock: null, approve: 'draft', approvedAt: null })
  expect(plannerAccess({ canApprove: true, approvedAt: null, hasEdits: true }).approve).toBe('draft')
  expect(plannerAccess({ canApprove: true, approvedAt: null, hasEdits: false }).approve).toBe('plan')
})

test('a trip past planning locks the plan with its phase as the reason, whatever the account may do', () => {
  expect(plannerAccess({ phase: 'loading', canApprove: true, approvedAt: APPROVED_AT, hasEdits: false }))
    .toStrictEqual({ lock: 'loading', approve: null, approvedAt: APPROVED_AT })
  expect(plannerAccess({ phase: 'cancelled', canApprove: false, approvedAt: null, hasEdits: false }))
    .toStrictEqual({ lock: 'cancelled', approve: null, approvedAt: null })
})

test('an account without the approve permission reads the plan only: waiting for the company manager, or already approved (LM-104)', () => {
  expect(plannerAccess({ phase: 'planning', canApprove: false, approvedAt: null, hasEdits: false }))
    .toStrictEqual({ lock: 'awaitingApproval', approve: null, approvedAt: null })
  expect(plannerAccess({ phase: 'planning', canApprove: false, approvedAt: APPROVED_AT, hasEdits: false }))
    .toStrictEqual({ lock: 'readOnly', approve: null, approvedAt: APPROVED_AT })
})
