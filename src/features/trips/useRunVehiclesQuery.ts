import { useQuery } from '@tanstack/react-query'
import type { LoadPlan } from '@/features/optimization/load-plans-backend-api'
import { fetchRunVehicles } from './run-vehicles-api'

/** Xe của các phương án một lần chạy; dưới khoá so sánh của lần chạy nên ghi của chuyến làm mới cả nó. */
export function useRunVehiclesQuery(tripParam: string, jobId: string, plans: readonly LoadPlan[]) {
  return useQuery({
    queryKey: ['trips', tripParam, 'run-comparison', jobId, 'vehicles', plans.map((plan) => `${plan.id}:${plan.vehicleId ?? ''}`).join(',')],
    queryFn: () => fetchRunVehicles(tripParam, plans),
    enabled: jobId !== '' && plans.length > 0,
    staleTime: 60_000,
  })
}
