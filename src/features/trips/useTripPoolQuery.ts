import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { addTripPackages, fetchTripPoolPackages, removeTripPackage, type AddTripPackagesInput } from './trip-pool-api'

/**
 * Hook Query cho kiện kho kiện đưa thẳng vào chuyến (FE-4b-05). Khoá đọc nằm dưới `['trips', tripId]`: mọi ghi của chuyến làm mới nó.
 * Thêm / bỏ kiện đổi dòng kiện của chuyến (revision cũ lỗi thời, D-31) và trạng thái kiện ở kho kiện, nên làm mới cả chuyến, bảng
 * điều khiển, kho kiện và danh sách kiện chọn được của yêu cầu giao.
 */
export function useTripPoolPackagesQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'pool-packages'], queryFn: () => fetchTripPoolPackages(tripId), enabled: tripId !== '', staleTime: 0 })
}

function refresh(client: QueryClient, tripId: string) {
  const keys = [['trips', tripId], ['trips', 'list'], ['dashboard'], ['package-pool'], ['requirements']]
  return Promise.all(keys.map((queryKey) => client.invalidateQueries({ queryKey })))
}

export function useAddTripPackagesMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (input: AddTripPackagesInput) => addTripPackages(tripId, input), onSuccess: () => refresh(client, tripId) })
}

export function useRemoveTripPackageMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({ mutationFn: (packageId: string) => removeTripPackage(tripId, packageId), onSuccess: () => refresh(client, tripId) })
}
