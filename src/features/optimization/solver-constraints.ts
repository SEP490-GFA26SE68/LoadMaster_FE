import type { TFunction } from '@/lib/i18n'

/**
 * Mã ràng buộc cứng do dịch vụ tối ưu ghi vào `unplaced.violatedConstraints`.
 * Key i18n `serverPlans.constraints.*` trùng tên mã.
 */
export const SOLVER_CONSTRAINT_CODES = [
  'AXLE_CONFIG_MISSING',
  'AXLE_CONFIG_INVALID',
  'AXLE_PACKAGE_DATA_MISSING',
  'AXLE_INVALID_WEIGHT',
  'AXLE_LOAD_EXCEEDED',
  'AXLE_LOAD_INVALID',
  'PACKAGE_CANNOT_PASS_DOOR',
  'ORIENTATION_NOT_ALLOWED',
  'NO_FEASIBLE_SPACE',
  'WEIGHT_LIMIT_EXCEEDED',
  'INVALID_VEHICLE_DATA',
  'INVALID_PACKAGE_DATA',
  'OPTIMIZATION_TIME_LIMIT_REACHED',
  'FRAGILITY_VIOLATION',
  'INSUFFICIENT_SUPPORT_AREA',
  'STABILITY_VIOLATION',
  'COG_PACKAGE_DATA_MISSING',
  'COG_CONFIG_INVALID',
  'COG_INVALID_WEIGHT',
  'CENTER_OF_GRAVITY_OUT_OF_RANGE',
  'NON_OVERLAP_VIOLATION',
  'INVALID_PAYLOAD_DATA',
  'PAYLOAD_EXCEEDED',
  'BOUNDARY_VIOLATION',
  'OBSTACLE_OVERLAP',
  'MULTI_DROP_LIFO_VIOLATION',
  'PINNED_PLACEMENT_UNSUPPORTED',
] as const

export type SolverConstraintCode = (typeof SOLVER_CONSTRAINT_CODES)[number]

const KNOWN = new Set<string>(SOLVER_CONSTRAINT_CODES)

export function isSolverConstraint(code: string): code is SolverConstraintCode {
  return KNOWN.has(code)
}

export function solverConstraintMessage(code: string, t: TFunction): string {
  const trimmed = code.trim()
  if (isSolverConstraint(trimmed)) return t(`serverPlans.constraints.${trimmed}`)
  return t('serverPlans.constraints.UNKNOWN', { code: trimmed })
}

/** Gộp mã ràng buộc của mọi kiện chưa xếp, giữ thứ tự gặp lần đầu. */
export function uniqueSolverConstraints(
  plans: readonly { unplaced?: readonly { violatedConstraints?: readonly string[] | null }[] | null }[],
): string[] {
  const seen = new Set<string>()
  const codes: string[] = []
  for (const plan of plans) {
    for (const item of plan.unplaced ?? []) {
      for (const raw of item.violatedConstraints ?? []) {
        const code = raw.trim()
        if (!code || seen.has(code)) continue
        seen.add(code)
        codes.push(code)
      }
    }
  }
  return codes
}
