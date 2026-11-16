import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { RequirementChanges, RequirementInput } from '@/lib/mock-db'
import {
  assignRequirementToTrip,
  createDeliveryRequirement,
  deleteDeliveryRequirement,
  fetchAssignableTrips,
  getDeliveryRequirement,
  listDeliveryRequirements,
  unassignRequirementFromTrip,
  updateDeliveryRequirement,
  type AssignRequirementInput,
  type UnassignRequirementInput,
} from './requirements-api'
import { fetchRequirementPackageChoices } from './requirement-pool-api'

/**
 * Hook Query của yêu cầu giao (FE-4b-02), khoá `['requirements', …]`. Trạng thái yêu cầu đổi theo chuyến và kiện (đang giao, đã giao,
 * giao thiếu) nên đọc lại mỗi lần mở màn. Ghi yêu cầu làm mới yêu cầu, kho kiện (kiện trống để chọn) và — khi đưa vào / gỡ khỏi
 * chuyến, hoặc đổi ưu tiên của yêu cầu đã vào chuyến — chuyến, revision, bảng điều khiển.
 */

/**
 * Khoá **duy nhất** của danh sách yêu cầu giao của máy chủ: màn Yêu cầu giao, hộp đưa yêu cầu vào chuyến, form kiện và nhập file kiện của
 * kho kiện cùng đọc một bản cache. Danh sách của một chuyến nằm dưới `['trips', tripId, 'requirements']`.
 */
export const REQUIREMENTS_LIST_KEY = ['requirements', 'list'] as const

/** `enabled`: hộp thoại chỉ đọc khi mở. */
export function useRequirementsQuery({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: REQUIREMENTS_LIST_KEY, queryFn: listDeliveryRequirements, staleTime: 0, enabled })
}

export function useRequirementQuery(id: string) {
  return useQuery({ queryKey: ['requirements', 'one', id], queryFn: () => getDeliveryRequirement(id), enabled: id !== '', staleTime: 0 })
}

/** Kiện chọn được cho form (`requirementId` vắng là form tạo mới). */
export function useRequirementPackageChoicesQuery(requirementId: string | undefined) {
  return useQuery({ queryKey: ['requirements', 'pool-choices', requirementId ?? ''], queryFn: () => fetchRequirementPackageChoices(requirementId), staleTime: 0 })
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

/** Đưa yêu cầu vào chuyến: chuyến có thêm dòng kiện (và có thể thêm điểm giao tự sinh), revision cũ lỗi thời — làm mới cả chuyến. */
export function useAssignRequirementMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: AssignRequirementInput) => assignRequirementToTrip(input), onSuccess: () => refreshRequirements(client, true) })
}

/** Gỡ yêu cầu khỏi chuyến: chuyến mất điểm giao của yêu cầu, tuyến bỏ, phương án lỗi thời — làm mới cả chuyến. */
export function useUnassignRequirementMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: UnassignRequirementInput) => unassignRequirementFromTrip(input), onSuccess: () => refreshRequirements(client, true) })
}
