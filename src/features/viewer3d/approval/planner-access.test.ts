import { expect, test } from 'vitest'
import { plannerAccess } from './planner-access'

/** Nút Duyệt, chỗ "Đã duyệt lúc …" và khoá chỉnh sửa của Planner (LM-094, D-45, D-51, LM-104, LM-108). */

const APPROVED_AT = '2026-09-14T02:00:00.000Z'

test('an approved revision without edits has no Approve button and shows when it was approved', () => {
  expect(plannerAccess({ canApprove: true, approvedAt: APPROVED_AT, hasEdits: false }))
    .toStrictEqual({ lock: null, approve: null, approvedAt: APPROVED_AT, notice: null })
})

test('edits on any revision offer "Approve edits"; an unapproved revision without edits offers "Approve plan"', () => {
  expect(plannerAccess({ canApprove: true, approvedAt: APPROVED_AT, hasEdits: true }))
    .toStrictEqual({ lock: null, approve: 'draft', approvedAt: null, notice: null })
  expect(plannerAccess({ canApprove: true, approvedAt: null, hasEdits: true }).approve).toBe('draft')
  expect(plannerAccess({ canApprove: true, approvedAt: null, hasEdits: false }).approve).toBe('plan')
})

test('a trip past planning locks the plan with its phase as the reason, whatever the account may do', () => {
  expect(plannerAccess({ phase: 'loading', canApprove: true, approvedAt: APPROVED_AT, hasEdits: false }))
    .toStrictEqual({ lock: 'loading', approve: null, approvedAt: APPROVED_AT, notice: null })
  expect(plannerAccess({ phase: 'cancelled', canApprove: false, canEdit: true, approvedAt: null, hasEdits: false }))
    .toStrictEqual({ lock: 'cancelled', approve: null, approvedAt: null, notice: null })
})

test('the dispatcher edits but does not approve: no lock, "Save edits" once a package moved, a waiting line before (LM-108)', () => {
  expect(plannerAccess({ canApprove: false, canEdit: true, approvedAt: null, hasEdits: false }))
    .toStrictEqual({ lock: null, approve: null, approvedAt: null, notice: 'awaitingApproval' })
  expect(plannerAccess({ canApprove: false, canEdit: true, approvedAt: null, hasEdits: true }))
    .toStrictEqual({ lock: null, approve: 'save', approvedAt: null, notice: null })
  expect(plannerAccess({ canApprove: false, canEdit: true, approvedAt: APPROVED_AT, hasEdits: false }))
    .toStrictEqual({ lock: null, approve: null, approvedAt: APPROVED_AT, notice: null })
  expect(plannerAccess({ canApprove: false, canEdit: true, approvedAt: APPROVED_AT, hasEdits: true }).approve).toBe('save')
})

test('an account that may neither edit nor approve reads the plan only (LM-104)', () => {
  expect(plannerAccess({ phase: 'planning', canApprove: false, approvedAt: null, hasEdits: false }))
    .toStrictEqual({ lock: 'awaitingApproval', approve: null, approvedAt: null, notice: null })
  expect(plannerAccess({ phase: 'planning', canApprove: false, approvedAt: APPROVED_AT, hasEdits: false }))
    .toStrictEqual({ lock: 'readOnly', approve: null, approvedAt: APPROVED_AT, notice: null })
})

test('a plan the company manager sent back is view only for everyone, but a trip phase still wins (LM-104)', () => {
  expect(plannerAccess({ canApprove: true, approvedAt: null, hasEdits: false, decided: true }))
    .toStrictEqual({ lock: 'decided', approve: null, approvedAt: null, notice: null })
  expect(plannerAccess({ canApprove: false, canEdit: true, approvedAt: null, hasEdits: false, decided: true }).lock).toBe('decided')
  expect(plannerAccess({ phase: 'cancelled', canApprove: true, approvedAt: null, hasEdits: false, decided: true }).lock).toBe('cancelled')
})
