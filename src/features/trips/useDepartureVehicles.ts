import { useQuery } from '@tanstack/react-query'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { fetchBackendTripFormOptions } from './trips-backend-api'

export const departureVehicleKey = (company: string | undefined, user: string | undefined, warehouse: string, trip?: string) =>
  ['trips', 'departure-options', company ?? null, user ?? null, warehouse, trip ?? null] as const

/** Missing identity/warehouse fails closed; never keeps options from the previous scope. */
export function useDepartureVehicles(warehouse: string, trip?: string) {
  const auth = useAuthSafe()
  return useQuery({
    queryKey: departureVehicleKey(auth?.user?.companyId, auth?.user?.id, warehouse, trip),
    enabled: Boolean(auth?.user?.companyId && auth.user.id && warehouse),
    queryFn: () => fetchBackendTripFormOptions(warehouse, trip),
    staleTime: 0,
  })
}
