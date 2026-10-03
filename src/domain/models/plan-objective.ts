/**
 * Ba mục tiêu của một lần chạy tối ưu (FE-5b-05, D-77): mỗi lần chạy ra ba phương án ứng viên, mỗi phương án theo một mục tiêu —
 * tối đa thể tích, cân tải trục, ít dỡ-xếp lại. Thứ tự ở đây là thứ tự A · B · C của màn so sánh. Ngoài type Spec.
 */
export const PLAN_OBJECTIVES = ['MAX_VOLUME', 'AXLE_BALANCE', 'MIN_REHANDLING'] as const
export type PlanObjective = (typeof PLAN_OBJECTIVES)[number]

/** Nhãn ứng viên của từng mục tiêu. Nhãn suy từ mục tiêu, không lưu riêng. */
export const PLAN_LABELS = { MAX_VOLUME: 'A', AXLE_BALANCE: 'B', MIN_REHANDLING: 'C' } as const satisfies Record<PlanObjective, string>
export type PlanLabel = (typeof PLAN_LABELS)[PlanObjective]
