import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { refreshSourcing } from '@/features/packages-source/usePackagesSourceQuery'
import type { ShipmentChanges, ShipmentInput } from '@/lib/mock-db'
import { createShipment, deleteShipment, fetchShipment, fetchShipments, fetchShippablePackages, handOverShipment, updateShipment } from './shipments-api'

/**
 * Hook Query của lô hàng (LM-104). Lô đổi trạng thái khi logistics quét nhận ở màn khác nên đọc lại mỗi lần mở (`staleTime: 0`);
 * người đăng nhập nằm trong khoá vì kho lọc theo công ty.
 */

export function useShipmentsQuery() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['shipments', 'list', user?.id ?? null], queryFn: fetchShipments, staleTime: 0 })
}

export function useShipmentQuery(id: string) {
  const { user } = useAuth()
  return useQuery({ queryKey: ['shipments', 'one', id, user?.id ?? null], queryFn: () => fetchShipment(id), enabled: id !== '', staleTime: 0 })
}

/** Kiện còn chọn được cho lô mới / lô nháp. */
export function useShippablePackagesQuery() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['shipments', 'shippable', user?.id ?? null], queryFn: fetchShippablePackages, staleTime: 0 })
}

export function useCreateShipmentMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: ShipmentInput) => createShipment(input), onSuccess: () => refreshSourcing(client) })
}

export function useUpdateShipmentMutation(id: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (changes: ShipmentChanges) => updateShipment(id, changes), onSuccess: () => refreshSourcing(client) })
}

export function useDeleteShipmentMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (id: string) => deleteShipment(id), onSuccess: () => refreshSourcing(client) })
}

/** Bàn giao lô nháp cho công ty logistics: kiện sang "đang giao cho logistics", lô hiện ở màn nhận hàng của công ty đó. */
export function useHandOverShipmentMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (id: string) => handOverShipment(id), onSuccess: () => refreshSourcing(client) })
}
