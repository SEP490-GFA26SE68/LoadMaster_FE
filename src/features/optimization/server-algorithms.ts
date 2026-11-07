import type { TFunction } from '@/lib/i18n'

/**
 * Tên đọc được của mã thuật toán máy chủ ghi. Phương án: thuật toán đã tạo ra nó (`load_plans.algorithm_name`); lần chạy: hạng của gói
 * (`optimization_jobs.algorithm_name`). Phương án cũ máy chủ trả mã của lần chạy nên tên phương án tra cả hai bảng; mã lạ giữ nguyên.
 * Chỉ màn So sánh và Thiết lập tối ưu dùng (từ vựng thuật toán).
 */
const PLAN_ALGORITHMS = ['EP_DBLF', 'GA', 'SA', 'EP_LUMO_R1_1', 'LUMO_R1', 'LUMO_R1_1', 'LUMO_R2'] as const
const RUN_ALGORITHMS = ['EP_DBLF', 'EP_DBLF_GA', 'EP_DBLF_GA_AI'] as const

export function runAlgorithmLabel(code: string, t: TFunction): string {
  const known = RUN_ALGORITHMS.find((item) => item === code)
  return known === undefined ? code : t(`serverPlans.algorithms.run.${known}`)
}

export function planAlgorithmLabel(code: string, t: TFunction): string {
  const known = PLAN_ALGORITHMS.find((item) => item === code)
  return known === undefined ? runAlgorithmLabel(code, t) : t(`serverPlans.algorithms.plan.${known}`)
}
