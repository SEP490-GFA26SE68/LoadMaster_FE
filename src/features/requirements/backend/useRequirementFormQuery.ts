import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTripById } from '@/features/trips/trips-api'
import type { DeliveryRequirement } from '@/lib/mock-db'
import { createCustomer, fetchCustomers } from './customers-api'
import { extendRequirementDeadline, updateRequirementCoordinates, updateRequirementSchedule } from './requirements-api'

/**
 * Hook Query riêng của form yêu cầu giao máy chủ (mục 9: component không gọi `-api.ts`): khách hàng, trạng thái chuyến đang giữ yêu cầu,
 * thêm toạ độ, đổi hạn / ưu tiên, gia hạn. Ghi yêu cầu làm mới `['requirements']`; lệnh đổi điểm giao của chuyến làm mới cả `['trips']`.
 */

/** Trạng thái chuyến đang giữ yêu cầu (`tripId` vắng: không đọc) — quyết định ô nào còn sửa được. */
export function useRequirementTripQuery(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trips', tripId, 'status'],
    queryFn: () => fetchTripById(tripId ?? ''),
    enabled: Boolean(tripId),
    retry: false,
  })
}

export function useCustomersQuery() {
  return useQuery({ queryKey: ['customers', 'list'], queryFn: fetchCustomers })
}

export function useCreateCustomerMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: createCustomer, onSuccess: () => client.invalidateQueries({ queryKey: ['customers'] }) })
}

export function useUpdateRequirementCoordinatesMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, lat, lng }: { id: string; lat: number; lng: number }) =>
      updateRequirementCoordinates(id, { destinationLat: lat, destinationLng: lng }),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['requirements'] }),
      client.invalidateQueries({ queryKey: ['trips'] }),
    ]),
  })
}

export function useUpdateRequirementScheduleMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, deadline, priority }: { id: string; deadline?: string; priority: DeliveryRequirement['priority'] }) =>
      updateRequirementSchedule(id, { deadline, priority }),
    onSuccess: () => client.invalidateQueries({ queryKey: ['requirements'] }),
  })
}

export function useExtendRequirementDeadlineMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, newDeadline, reason }: { id: string; newDeadline: string; reason: string }) =>
      extendRequirementDeadline(id, { newDeadline, reason }),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['requirements'] }),
      client.invalidateQueries({ queryKey: ['trips'] }),
    ]),
  })
}
