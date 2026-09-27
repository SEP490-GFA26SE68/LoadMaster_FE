import { z } from 'zod'
import type { ReviewDecisionInput } from '@/features/review/review-api'
import type { TFunction } from '@/lib/i18n'
import type { PlannerAccess } from './approval/planner-access'

/**
 * Thanh quyết định của quản lý công ty trong Planner (luồng 4 Review 1, LM-104): ngoài Duyệt còn Từ chối, Yêu cầu tối ưu lại và Đề
 * xuất đổi xe / tách chuyến. Module thuần: khi nào hiện thanh, schema của hộp thoại và lệnh gửi kho.
 */

export type DecisionDialogKind = 'reject' | 'reoptimize' | 'suggest'

export const SUGGESTION_KINDS = ['change_vehicle', 'split_trip'] as const

/** Giá trị Select "không chỉ định xe" — Radix Select không nhận chuỗi rỗng làm giá trị mục. */
export const ANY_VEHICLE = 'none'

export const REASON_MAX = 500

/**
 * Thanh quyết định chỉ hiện khi bản đang xem có nút "Duyệt phương án" (chưa duyệt, không chỉnh tay, không khoá), tài khoản được xét
 * duyệt (`plans.review`) và kho còn giữ bản này trong hàng đợi chờ duyệt — bản cũ hơn bản mới nhất hay đã có quyết định thì không.
 */
export function canDecide({ access, reviewable, canReview }: { access: PlannerAccess; reviewable: boolean; canReview: boolean }): boolean {
  return access.approve === 'plan' && reviewable && canReview
}

export function decisionSchema(t: TFunction) {
  return z.object({
    reason: z.string().trim().min(1, t('review.decide.reasonRequired')).max(REASON_MAX, t('review.decide.reasonTooLong')),
    suggestion: z.enum(SUGGESTION_KINDS),
    vehicleId: z.string(),
  })
}

export type DecisionValues = z.infer<ReturnType<typeof decisionSchema>>

export const DEFAULT_DECISION: DecisionValues = { reason: '', suggestion: 'change_vehicle', vehicleId: ANY_VEHICLE }

/** Lệnh gửi kho từ giá trị hộp thoại; xe đề xuất chỉ đi kèm đề xuất đổi xe và khi đã chọn một xe. */
export function decisionInput(kind: DecisionDialogKind, revisionId: string, { reason, suggestion, vehicleId }: DecisionValues): ReviewDecisionInput {
  const text = reason.trim()
  if (kind !== 'suggest') return { kind, revisionId, reason: text }
  const vehicle = suggestion === 'change_vehicle' && vehicleId !== ANY_VEHICLE ? { vehicleId } : {}
  return { kind, revisionId, suggestion: { kind: suggestion, note: text, ...vehicle } }
}
