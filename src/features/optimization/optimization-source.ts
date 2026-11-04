import { RUNNABLE_ALGORITHMS, type OptimizationAlgorithm, type OptimizationSource } from '@/lib/mock-db'

/**
 * Nguồn chạy tối ưu xếp hàng của app: hiện luôn là mock trong trình duyệt. Thuật toán nguồn chạy được nằm ở một bảng,
 * `RUNNABLE_ALGORITHMS` của kho; khi backend chuyển được thuật toán đã chọn cho dịch vụ tối ưu thì thêm nguồn vào bảng đó và đổi
 * hằng này, màn và lớp API không đổi.
 */
export const OPTIMIZATION_SOURCE: OptimizationSource = 'mock'

/** Thuật toán nguồn hiện tại chạy được: ô chọn thuật toán làm mờ phần còn lại, `runOptimization` từ chối chúng trước khi giữ credit. */
export const RUNNABLE_RUN_ALGORITHMS: readonly OptimizationAlgorithm[] = RUNNABLE_ALGORITHMS[OPTIMIZATION_SOURCE]
