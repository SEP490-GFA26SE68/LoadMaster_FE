import { expandPackages, type PackageInstance } from '@/domain/cargo'
import { pinnedIssues, validateRequest, type ConstraintCode } from '@/domain/constraints'
import { optimizationRequestSchema, type OptimizationRequest, type UnplacedPackage } from '@/domain/models'

type ReasonCode = UnplacedPackage['reasonCode']

/** Lỗi của từng kiện không làm hỏng cả job: kiện đó thành "chưa xếp" với lý do tương ứng (Spec mục 11). */
const PACKAGE_REASONS: Partial<Record<ConstraintCode, ReasonCode>> = {
  DOOR_TOO_SMALL: 'DOOR_TOO_SMALL',
  NO_ALLOWED_ORIENTATION: 'NO_ALLOWED_ORIENTATION',
}

export type Preflight =
  | { readonly ok: false; readonly instances: readonly PackageInstance[] }
  | {
      readonly ok: true
      readonly instances: readonly PackageInstance[]
      /** Lý do chưa xếp định sẵn theo `packageInstanceId` (kiện không qua cửa, không còn hướng đặt). */
      readonly reasons: ReadonlyMap<string, ReasonCode>
    }

/**
 * Kiểm request trước khi xếp:
 * - sai schema LM-010 (kể cả quy tắc chưa có mã ràng buộc và `settings`) → không chạy, `FAILED`, không có instance;
 * - còn `error` của `validateRequest` ngoài lỗi riêng từng kiện (xe, vật cản, riêng kiện `mustLoad` vượt tải, trùng mã) → `FAILED`;
 * - `DOOR_TOO_SMALL`, `NO_ALLOWED_ORIENTATION` của một kiện → mọi instance của kiện đó chưa xếp với lý do tương ứng;
 * - bộ kiện ghim (FE-BL-02) không đứng vững một mình (`pinnedIssues`) → `FAILED`: mock không sửa ngầm bộ ghim.
 */
export function preflight(request: OptimizationRequest): Preflight {
  if (!optimizationRequestSchema.safeParse(request).success) return { ok: false, instances: [] }
  const { instances, packageIdByInstanceId } = expandPackages(request.packages)
  const reasonByPackage = new Map<string, ReasonCode>()
  for (const issue of validateRequest(request)) {
    if (issue.severity !== 'error') continue
    const reason = PACKAGE_REASONS[issue.code]
    if (reason === undefined || !('packageId' in issue.params)) return { ok: false, instances }
    if (!reasonByPackage.has(issue.params.packageId)) reasonByPackage.set(issue.params.packageId, reason)
  }
  if (pinnedIssues(request).length > 0) return { ok: false, instances }
  const reasons = new Map<string, ReasonCode>()
  for (const { packageInstanceId } of instances) {
    const reason = reasonByPackage.get(packageIdByInstanceId.get(packageInstanceId) ?? '')
    if (reason !== undefined) reasons.set(packageInstanceId, reason)
  }
  return { ok: true, instances, reasons }
}
