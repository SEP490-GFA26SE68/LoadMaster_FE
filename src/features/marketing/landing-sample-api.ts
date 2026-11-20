/**
 * Hàm → endpoint backend (FE-0-09). Trang công khai, không cần đăng nhập.
 *   runLandingSample → không có endpoint: bộ tối ưu mô phỏng chạy ngay trên trình duyệt của người xem
 */

import { createOptimizationService, type CandidatePlan } from '@/services/optimization'
import { LANDING_REQUEST } from './landing-sample.mock'

/**
 * Chạy chuyến mẫu của khung 3D trên trang giới thiệu bằng đúng bộ tối ưu mô phỏng của ứng dụng — trong Web Worker khi trình duyệt có
 * (luồng chính vẫn rảnh), trên luồng gọi khi không có: **một** lần chạy ra ba phương án ứng viên A · B · C (`optimizeCandidates`, theo thứ
 * tự `PLAN_OBJECTIVES`). Kết quả luôn `isMockResult`; trang công khai không hiện nhãn MOCK RESULT, câu dưới khung nói số do bộ tối ưu
 * mô phỏng tính.
 */
// không có endpoint — chạy trên trình duyệt
export async function runLandingSample(): Promise<readonly CandidatePlan[]> {
  const run = await createOptimizationService().optimizeCandidates(LANDING_REQUEST)
  if (run.plans.length === 0 || run.plans.some((plan) => plan.result.status !== 'COMPLETED')) {
    throw new Error('Chuyến mẫu của trang giới thiệu không xếp được')
  }
  return run.plans
}
