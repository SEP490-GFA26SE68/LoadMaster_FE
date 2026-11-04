import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { OptimizationRequest } from '@/domain/models'
import type { OptimizationAlgorithm } from '@/lib/mock-db'
import { changeTripVehicle, fetchOptimizationCredit, fetchOptimizationSetup, runOptimization } from './optimization-api'
import type { RunProgress } from './run-progress'

/** Chuyến, xe đang gán và danh sách xe cho màn Thiết lập tối ưu (LM-047); `pinRevisionId`: phương án có kiện ghim để giữ (FE-BL-02). */
export function useOptimizationSetupQuery(tripId: string, pinRevisionId?: string) {
  return useQuery({ queryKey: ['trips', tripId, 'optimization-setup', pinRevisionId ?? null], queryFn: () => fetchOptimizationSetup(tripId, pinRevisionId), enabled: tripId !== '' })
}

/**
 * Gói và credit của công ty cho lần chạy (FE-8-05): số dư đổi theo từng lần chạy nên không giữ cache (`staleTime: 0`), và lần chạy
 * xong làm mới nó. Khoá dưới `['billing']` để màn gói cước (FE-8-03) làm mới cùng.
 */
export function useOptimizationCreditQuery() {
  return useQuery({ queryKey: ['billing', 'optimization-credit'], queryFn: fetchOptimizationCredit, staleTime: 0 })
}

/** Đổi xe của chuyến: đầu vào tối ưu đổi nên làm mới chuyến, revision và bảng điều khiển. */
export function useChangeVehicleMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (vehicleId: string) => changeTripVehicle(tripId, vehicleId),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['trips', tripId] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ]),
  })
}

/**
 * Một lần chạy tối ưu (LM-048; ba phương án ứng viên, FE-5b-05): mutation gọi service, giữ bước đang làm và tiến trình của từng phương
 * án, và cho huỷ. Cả ba phương án chạy bằng thuật toán điều phối viên đã chọn (`algorithm`).
 * Huỷ là `abort` — worker bị `terminate`, cả ba phương án bị bỏ, không revision nào được tạo. Xong thì làm mới revision của chuyến để
 * Planner và So sánh đọc bản mới.
 */
export function useOptimizationRun(tripId: string) {
  const client = useQueryClient()
  const controller = useRef<AbortController | null>(null)
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const mutation = useMutation({
    mutationFn: ({ request, algorithm, simulateFailure }: { request: OptimizationRequest; algorithm: OptimizationAlgorithm; simulateFailure: boolean }) => {
      controller.current = new AbortController()
      setProgress({ total: request.packages.reduce((sum, pkg) => sum + pkg.quantity, 0), stage: 'reserve', plans: {} })
      return runOptimization({
        tripId, request, algorithm, simulateFailure, signal: controller.current.signal,
        onStage: (stage) => setProgress((current) => current && { ...current, stage }),
        onProgress: ({ objective, placed, total }) => setProgress((current) => ({
          total, stage: current?.stage ?? 'pack', plans: { ...current?.plans, [objective]: { placed, total } },
        })),
      })
    },
    onSettled: () => {
      controller.current = null
      setProgress(null)
      return Promise.all([
        client.invalidateQueries({ queryKey: ['trips', tripId] }),
        client.invalidateQueries({ queryKey: ['dashboard'] }),
        // Số dư credit đổi theo lần chạy; sự kiện "sắp hết credit" nằm ở chuông của quản trị công ty
        client.invalidateQueries({ queryKey: ['billing'] }),
        client.invalidateQueries({ queryKey: ['notifications'] }),
      ])
    },
  })
  return { ...mutation, progress, cancel: () => controller.current?.abort() }
}
