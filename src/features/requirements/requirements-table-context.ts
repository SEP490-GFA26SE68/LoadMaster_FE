import { createContext, use } from 'react'
import type { RequirementRow } from './requirements-api'

export type RequirementAction = 'view' | 'edit' | 'delete' | 'assign' | 'unassign'

/**
 * Phần thay đổi theo thời gian mà ô của bảng yêu cầu giao cần (quyền, hàm thao tác). Hàm `cell` khai ở mức module vì TanStack Table
 * v9 dựng ô như component: dựng lại cột là gỡ menu thao tác đang mở (AGENTS mục 5, `users-table-context.ts`).
 */
export type RequirementsTableContextValue = {
  /** Quản lý công ty (`requirements.edit`): tạo, sửa, xoá. */
  readonly canEdit: boolean
  /** Điều phối viên (`trips.edit`): đưa vào chuyến, gỡ khỏi chuyến. */
  readonly canAssign: boolean
  readonly onAction: (action: RequirementAction, row: RequirementRow) => void
}

export const RequirementsTableContext = createContext<RequirementsTableContextValue | null>(null)

export function useRequirementsTable(): RequirementsTableContextValue {
  const value = use(RequirementsTableContext)
  if (!value) throw new Error('Ô bảng yêu cầu giao phải nằm trong <RequirementsTableContext>')
  return value
}
