import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { OrderChanges, OrderInput } from '@/lib/mock-db'
import {
  assignOrder,
  cancelOrder,
  createOrder,
  fetchAssignableTrips,
  fetchOrder,
  fetchOrderablePackages,
  fetchOrders,
  unassignOrder,
  updateOrder,
  type AssignOrderInput,
} from './orders-api'

/**
 * Hook Query của đơn hàng (LM-104). Trạng thái đơn đổi theo chuyến (đã giao khi chuyến hoàn thành) nên đọc lại mỗi lần mở màn.
 * Ghi đơn làm mới đơn, kiện đăng ký (kiện trống để chọn) và — khi gán / bỏ gán — chuyến, revision, bảng điều khiển.
 */

export function useOrdersQuery() {
  return useQuery({ queryKey: ['orders', 'list'], queryFn: fetchOrders, staleTime: 0 })
}

export function useOrderQuery(id: string) {
  return useQuery({ queryKey: ['orders', 'one', id], queryFn: () => fetchOrder(id), enabled: id !== '', staleTime: 0 })
}

export function useOrderablePackagesQuery() {
  return useQuery({ queryKey: ['orders', 'orderable'], queryFn: fetchOrderablePackages, staleTime: 0 })
}

export function useAssignableTripsQuery() {
  return useQuery({ queryKey: ['orders', 'assignable-trips'], queryFn: fetchAssignableTrips, staleTime: 0 })
}

function refreshOrders(client: QueryClient, tripsToo = false) {
  const keys = [['orders'], ['registered-packages'], ...(tripsToo ? [['trips'], ['dashboard'], ['warehouse']] : [])]
  return Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
}

export function useCreateOrderMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: OrderInput) => createOrder(input), onSuccess: () => refreshOrders(client) })
}

export function useUpdateOrderMutation(id: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (changes: OrderChanges) => updateOrder(id, changes), onSuccess: () => refreshOrders(client) })
}

export function useCancelOrderMutation(id: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (reason: string) => cancelOrder(id, reason), onSuccess: () => refreshOrders(client) })
}

/** Gán đơn vào điểm giao: chuyến có thêm dòng kiện, revision cũ lỗi thời — làm mới cả chuyến. */
export function useAssignOrderMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: AssignOrderInput) => assignOrder(input), onSuccess: () => refreshOrders(client, true) })
}

export function useUnassignOrderMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (orderId: string) => unassignOrder(orderId), onSuccess: () => refreshOrders(client, true) })
}
