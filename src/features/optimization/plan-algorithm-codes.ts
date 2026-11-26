/**
 * Mã thuật toán máy chủ ghi trên phương án (`load_plans.algorithm_name`). Module thuần, không import gì: lớp DTO (đọc cả từ cấu hình E2E,
 * nơi không dựng JSX) cần danh sách này mà không kéo theo từ điển.
 */
export const PLAN_ALGORITHMS = ['EP_DBLF', 'GA', 'SA', 'EP_LUMO_R1_1', 'LUMO_R1', 'LUMO_R1_1', 'LUMO_R2'] as const
