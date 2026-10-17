/**
 * Hàm → endpoint backend (FE-0-09). Trang công khai, không cần đăng nhập.
 *   runLandingSample → không có endpoint: bộ tối ưu mô phỏng chạy ngay trên trình duyệt của người xem
 */

import type { OptimizationResult } from '@/domain/models'
import { createOptimizationService } from '@/services/optimization'
import { LANDING_REQUEST } from './landing-sample.mock'

/**
 * Chạy chuyến mẫu của khung 3D trên trang giới thiệu bằng đúng bộ tối ưu mô phỏng của ứng dụng — trong Web Worker khi trình duyệt có
 * (luồng chính vẫn rảnh), trên luồng gọi khi không có. Kết quả luôn `isMockResult`; khung 3D hiện MOCK RESULT cạnh mọi số của nó.
 */
// không có endpoint — chạy trên trình duyệt
export async function runLandingSample(): Promise<OptimizationResult> {
  const result = await createOptimizationService().optimize(LANDING_REQUEST)
  if (result.status !== 'COMPLETED') throw new Error('Chuyến mẫu của trang giới thiệu không xếp được')
  return result
}
