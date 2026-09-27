import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import type { OptimizationRequest } from '@/domain/models'
import type { RunSettings } from '@/lib/mock-db'
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

/**
 * Một lần chạy tối ưu (LM-048): mutation gọi service, giữ tiến trình và cho huỷ. Huỷ là `abort` — worker bị `terminate`,
 * không revision nào được tạo. Xong thì làm mới revision của chuyến để Planner và So sánh đọc bản mới.
 */
export function useOptimizationRun(tripId: string) {
  const client = useQueryClient()
  const controller = useRef<AbortController | null>(null)
  const [progress, setProgress] = useState<OptimizationProgress | null>(null)
  const mutation = useMutation({
    mutationFn: ({ request, simulateFailure, run }: { request: OptimizationRequest; simulateFailure: boolean; run?: RunSettings }) => {
      controller.current = new AbortController()
      setProgress({ placed: 0, total: request.packages.reduce((sum, pkg) => sum + pkg.quantity, 0) })
      return runOptimization({ tripId, request, simulateFailure, run, signal: controller.current.signal, onProgress: setProgress })
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
