import type { OptimizationRequest, OptimizationResult } from '@/domain/models'
import { completedResult, failedResult, mockJobId, packInput, planMockRun } from './mock-plan'
import type { OptimizationProgress } from './OptimizationService'
import { packShelves } from './shelf-packer'

export type MockRunOptions = {
  /** Đồng hồ ms cho `runtimeMs`; test truyền đồng hồ giả để kết quả tất định. */
  readonly clock?: () => number
  readonly onProgress?: (progress: OptimizationProgress) => void
}

/**
 * Mock optimization thuần (Spec mục 11, LM-024) — chạy được trong worker và trong test, cùng request + seed cho cùng kết quả.
 * Kiểm request (`preflight`), xếp kệ (`packShelves`), rồi dùng domain cho phần còn lại (`completedResult`). Luôn `isMockResult: true`,
 * `method: 'MOCK'`. Đây là **một** kết quả theo contract `optimize(request)` của Spec; lần chạy của app ra ba phương án ứng viên qua
 * `runMockCandidates` (FE-5b-05).
 *
 * Vùng theo điểm giao (FE-5b-02, D-79): thùng chia theo tỷ lệ thể tích của các kiện **còn xếp được** (đã qua kiểm request và dành
 * tải) của từng điểm. Khi `enforceLifo`, kiện xếp theo vùng, điểm cuối trước; không bật thì xếp theo thứ tự chọn như trước. Cả hai
 * trường hợp kết quả đều mang `stopZones`, `stopZoneId` của từng placement và `metrics.rehandlingCount`.
 */
export function runMockOptimization(request: OptimizationRequest, { clock = () => performance.now(), onProgress }: MockRunOptions = {}): OptimizationResult {
  const startedAt = clock()
  const jobId = mockJobId(request)
  const planned = planMockRun(request)
  if (!planned.ok) return failedResult(request, planned.instances, jobId, clock() - startedAt)
  const { plan } = planned
  const { enforceLifo } = request.settings
  const packed = packShelves({
    ...packInput(plan, enforceLifo ? plan.lifo : plan.chosen),
    zones: enforceLifo ? plan.zones : undefined,
    onProgress,
  })
  return completedResult(plan, packed, jobId, () => clock() - startedAt)
}
