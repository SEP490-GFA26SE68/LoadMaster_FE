import { useQuery } from '@tanstack/react-query'
import { runLandingSample } from './landing-sample-api'

/**
 * Phương án của chuyến mẫu, tính một lần mỗi lần mở trang (không đổi theo dữ liệu nào nên không bao giờ cũ). `enabled` theo cổng của
 * khung 3D (`useStageGate`): máy không có WebGL hay đang tiết kiệm dữ liệu không chạy bộ tối ưu, không tải worker.
 */
export function useLandingSample(enabled: boolean) {
  return useQuery({
    queryKey: ['landing', 'sample-run'],
    queryFn: runLandingSample,
    enabled,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: false,
  })
}
