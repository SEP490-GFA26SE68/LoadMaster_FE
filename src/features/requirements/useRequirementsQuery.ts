import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { RequirementChanges, RequirementInput } from '@/lib/mock-db'
import {
  assignRequirementToTrip,
  createDeliveryRequirement,
  deleteDeliveryRequirement,
  fetchAssignableTrips,
  fetchSelectablePackages,
  getDeliveryRequirement,
  listDeliveryRequirements,
  unassignRequirementFromTrip,
  updateDeliveryRequirement,
  type AssignRequirementInput,
} from './requirements-api'

/**
 * Hook Query của yêu cầu giao (FE-4b-02), khoá `['requirements', …]`. Trạng thái yêu cầu đổi theo chuyến và kiện (đang giao, đã giao,
 * giao thiếu) nên đọc lại mỗi lần mở màn. Ghi yêu cầu làm mới yêu cầu, kho kiện (kiện trống để chọn) và — khi đưa vào / gỡ khỏi
 * chuyến, hoặc đổi ưu tiên của yêu cầu đã vào chuyến — chuyến, revision, bảng điều khiển.
 */

export function useRequirementsQuery() {
  return useQuery({ queryKey: ['requirements', 'list'], queryFn: listDeliveryRequirements, staleTime: 0 })
}

export function useRequirementQuery(id: string) {
  return useQuery({ queryKey: ['requirements', 'one', id], queryFn: () => getDeliveryRequirement(id), enabled: id !== '', staleTime: 0 })
}

export function useSelectablePackagesQuery() {
  return useQuery({ queryKey: ['requirements', 'selectable'], queryFn: fetchSelectablePackages, staleTime: 0 })
}

export function useAssignableTripsQuery() {
  return useQuery({ queryKey: ['requirements', 'assignable-trips'], queryFn: fetchAssignableTrips, staleTime: 0 })
}

function refreshRequirements(client: QueryClient, tripsToo = false) {
  const keys = [['requirements'], ['package-pool'], ...(tripsToo ? [['trips'], ['dashboard'], ['warehouse']] : [])]
  return Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
}

export function useCreateRequirementMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: RequirementInput) => createDeliveryRequirement(input), onSuccess: () => refreshRequirements(client) })
}

/** Đổi ưu tiên của yêu cầu đã vào chuyến đổi cả dòng kiện của chuyến: làm mới cả chuyến. */
export function useUpdateRequirementMutation(id: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (changes: RequirementChanges) => updateDeliveryRequirement(id, changes), onSuccess: () => refreshRequirements(client, true) })
}

export function useDeleteRequirementMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (id: string) => deleteDeliveryRequirement(id), onSuccess: () => refreshRequirements(client) })
}

/** Đưa yêu cầu vào điểm giao: chuyến có thêm dòng kiện, revision cũ lỗi thời — làm mới cả chuyến. */
export function useAssignRequirementMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: AssignRequirementInput) => assignRequirementToTrip(input), onSuccess: () => refreshRequirements(client, true) })
}

export function useUnassignRequirementMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (requirementId: string) => unassignRequirementFromTrip(requirementId), onSuccess: () => refreshRequirements(client, true) })
}
