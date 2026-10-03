import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { OptimizationRequest, PlanObjective } from '@/domain/models'
import type { OptimizationProgress } from '@/services/optimization'
import { changeTripVehicle, fetchOptimizationSetup, runOptimization } from './optimization-api'

/** Chuyến, xe đang gán và danh sách xe cho màn Thiết lập tối ưu (LM-047). */
export function useOptimizationSetupQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'optimization-setup'], queryFn: () => fetchOptimizationSetup(tripId), enabled: tripId !== '' })
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

/** Tiến trình của một lần chạy: tổng số kiện và số kiện đã xét của từng phương án ứng viên (phương án chưa tới lượt thì vắng). */
export type RunProgress = { readonly total: number; readonly plans: Partial<Record<PlanObjective, OptimizationProgress>> }

/**
 * Một lần chạy tối ưu (LM-048; ba phương án ứng viên, FE-5b-05): mutation gọi service, giữ tiến trình của từng phương án và cho huỷ.
 * Huỷ là `abort` — worker bị `terminate`, cả ba phương án bị bỏ, không revision nào được tạo. Xong thì làm mới revision của chuyến để
 * Planner và So sánh đọc bản mới.
 */
export function useOptimizationRun(tripId: string) {
  const client = useQueryClient()
  const controller = useRef<AbortController | null>(null)
  const [progress, setProgress] = useState<RunProgress | null>(null)
  const mutation = useMutation({
    mutationFn: ({ request, simulateFailure }: { request: OptimizationRequest; simulateFailure: boolean }) => {
      controller.current = new AbortController()
      setProgress({ total: request.packages.reduce((sum, pkg) => sum + pkg.quantity, 0), plans: {} })
      return runOptimization({
        tripId, request, simulateFailure, signal: controller.current.signal,
        onProgress: ({ objective, placed, total }) => setProgress((current) => ({ total, plans: { ...current?.plans, [objective]: { placed, total } } })),
      })
    },
    onSettled: () => {
      controller.current = null
      setProgress(null)
      return Promise.all([
        client.invalidateQueries({ queryKey: ['trips', tripId] }),
        client.invalidateQueries({ queryKey: ['dashboard'] }),
      ])
    },
  })
  return { ...mutation, progress, cancel: () => controller.current?.abort() }
}
