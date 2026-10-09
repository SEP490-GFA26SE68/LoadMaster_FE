import { expandPackages } from '@/domain/cargo'
import { gt, roundKg } from '@/domain/geometry'
import type { OptimizationRequest } from '@/domain/models'
import { createConstraintEngine } from './engine'
import type { ConstraintIssue } from './issues'

type PinnedInput = Pick<OptimizationRequest, 'vehicle' | 'packages' | 'settings' | 'pinnedPlacements'>

/**
 * Bộ kiện ghim của một request (FE-BL-02) có đứng vững **một mình** không — mock coi chúng là hộp cố định và chỉ xếp phần còn lại
 * quanh chúng, nên bộ ghim hỏng thì lần chạy không có nghĩa. Lý do từ chối là issue (mã + tham số) để UI dịch bằng `formatIssue`;
 * không sửa ngầm bộ ghim nào.
 * - kiện ghim không thuộc kiện nào của request, hoặc ghim hai lần: `PINNED_INSTANCE_UNKNOWN` / `DUPLICATE_INSTANCE_ID`;
 * - ra ngoài thùng, chồng lấn, đè vật cản, hướng đặt sai, xếp chồng quá giới hạn, tải trục: các lỗi của constraint engine chạy riêng
 *   trên bộ ghim;
 * - lơ lửng: diện tích đáy được đỡ (bởi sàn, vật cản chịu tải hoặc kiện ghim khác) dưới mức kiện yêu cầu — `SUPPORT_BELOW_MIN`, vốn
 *   chỉ là cảnh báo ở phương án, ở đây là lỗi vì chỗ đỡ của kiện không được xếp lại;
 * - tổng khối lượng vượt tải trọng xe: `PAYLOAD_EXCEEDED`.
 * Không có kiện ghim thì rỗng. Request phải qua `validateRequest` trước (trùng mã instance làm engine ném lỗi): trùng mã thì trả rỗng,
 * lỗi đó đã báo ở nơi khác.
 */
export function pinnedIssues({ vehicle, packages, settings, pinnedPlacements = [] }: PinnedInput): ConstraintIssue[] {
  if (pinnedPlacements.length === 0) return []
  const expanded = expandPackages(packages)
  if (expanded.issues.length > 0) return []
  const instances = new Map(expanded.instances.map((instance) => [instance.packageInstanceId, instance]))
  const seen = new Set<string>()
  const faults: ConstraintIssue[] = []
  for (const { packageInstanceId } of pinnedPlacements) {
    if (!instances.has(packageInstanceId)) {
      faults.push({ code: 'PINNED_INSTANCE_UNKNOWN', severity: 'error', packageInstanceId, params: {} })
    } else if (seen.has(packageInstanceId)) {
      faults.push({ code: 'DUPLICATE_INSTANCE_ID', severity: 'error', packageInstanceId, relatedIds: [packageInstanceId], params: { occurrences: 2 } })
    }
    seen.add(packageInstanceId)
  }
  if (faults.length > 0) return faults

  const totalKg = roundKg(pinnedPlacements.reduce((sum, { packageInstanceId }) => sum + (instances.get(packageInstanceId)?.weightKg ?? 0), 0))
  const payload: ConstraintIssue[] = gt(totalKg, vehicle.maxPayloadKg)
    ? [{ code: 'PAYLOAD_EXCEEDED', severity: 'error', params: { totalKg, maxPayloadKg: vehicle.maxPayloadKg, overKg: roundKg(totalKg - vehicle.maxPayloadKg) } }]
    : []
  const { issues } = createConstraintEngine({ vehicle, packages, placements: pinnedPlacements, settings }).evaluateAll()
  const refusals = issues.flatMap((issue): ConstraintIssue[] => {
    if (issue.code === 'SUPPORT_BELOW_MIN') return [{ ...issue, severity: 'error' }]
    return issue.severity === 'warning' ? [] : [issue]
  })
  return [...payload, ...refusals]
}
