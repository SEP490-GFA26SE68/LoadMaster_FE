import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import type { CargoPackage } from '@/domain/models'
import type { DeliveryStop } from '@/lib/mock-db'
import { addTripStop, removeTripStop, updateTripStops, type ManualStopInput } from './trip-stops-api'
import {
  cancelTrip,
  createTrip,
  deletePackage,
  duplicateTripPackage,
  fetchPackages,
  fetchTripActivity,
  fetchTripDetail,
  fetchTripFormOptions,
  fetchTripRevisions,
  fetchTrips,
  importPackages,
  savePackage,
  updateTripFrame,
  type TripFrame,
  type TripFrameChanges,
} from './trips-api'

/** Chuyến và kiện qua TanStack Query — component không gọi API trực tiếp (mục 9). */

export function useTripsQuery() {
  // Trạng thái và tỷ lệ của từng dòng đổi theo mọi mutation của từng chuyến (khoá `['trips', tripId]`): đọc lại mỗi lần mở màn.
  return useQuery({ queryKey: ['trips', 'list'], queryFn: fetchTrips, staleTime: 0 })
}

/** Xe (kèm trạng thái bảo dưỡng) và tài xế của form chuyến: đọc lại mỗi lần mở form vì Đội xe và Người dùng đổi chúng. */
export function useTripFormOptionsQuery() {
  return useQuery({ queryKey: ['trips', 'form-options'], queryFn: fetchTripFormOptions, staleTime: 0 })
}

/** Tạo chuyến: làm mới danh sách chuyến và bảng điều khiển. */
export function useCreateTripMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (frame: TripFrame) => createTrip(frame),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['trips'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ]),
  })
}

export function useUpdateTripFrameMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (changes: TripFrameChanges) => updateTripFrame(tripId, changes),
    onSuccess: () => Promise.all([
      invalidateTrip(client, tripId),
      client.invalidateQueries({ queryKey: ['trips', 'list'] }),
    ]),
  })
}

/** Huỷ chuyến: đổi trạng thái ở chi tiết, danh sách và bảng điều khiển. */
export function useCancelTripMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (reason: string) => cancelTrip(tripId, reason),
    onSuccess: () => Promise.all([
      invalidateTrip(client, tripId),
      client.invalidateQueries({ queryKey: ['trips', 'list'] }),
    ]),
  })
}

export function useTripDetailQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'detail'], queryFn: () => fetchTripDetail(tripId), enabled: tripId !== '' })
}

/**
 * Revision, nhật ký, người dùng cho thẻ Tiến trình. Kho và tài xế ghi tiến độ ở màn khác (không qua hook của màn này), nên đọc lại
 * mỗi lần mở chi tiết chuyến.
 */
export function useTripActivityQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'activity'], queryFn: () => fetchTripActivity(tripId), enabled: tripId !== '', staleTime: 0 })
}

/** Khoá nằm dưới `['trips', tripId]` nên mọi mutation của chuyến và lần tối ưu mới đều làm mới danh sách này. */
export function useTripRevisionsQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'revisions'], queryFn: () => fetchTripRevisions(tripId), enabled: tripId !== '' })
}

export function usePackagesQuery(tripId: string) {
  return useQuery({ queryKey: ['trips', tripId, 'packages'], queryFn: () => fetchPackages(tripId), enabled: tripId !== '' })
}

/**
 * Mọi thay đổi xe, điểm giao hay kiện đều đổi đầu vào tối ưu: làm mới cả chuyến, kiện và danh sách revision
 * (revision cũ thành lỗi thời theo `inputVersion`, D-31), và tổng kiện/khối lượng của bảng điều khiển (LM-052).
 */
function invalidateTrip(client: QueryClient, tripId: string) {
  return Promise.all([
    client.invalidateQueries({ queryKey: ['trips', tripId] }),
    client.invalidateQueries({ queryKey: ['dashboard'] }),
  ])
}

export function useTripStopsMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (stops: readonly DeliveryStop[]) => updateTripStops(tripId, stops),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

/** Thêm điểm giao tay cuối tuyến (FE-4b-04). */
export function useAddStopMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (stop: ManualStopInput) => addTripStop(tripId, stop),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useRemoveStopMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (stopId: string) => removeTripStop(tripId, stopId),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useSavePackageMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ pkg, overrideReason }: { pkg: CargoPackage; overrideReason?: string }) => savePackage(tripId, pkg, overrideReason),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

/** Nhập kiện từ file (LM-093): một lần ghi, làm mới chuyến, revision (lỗi thời) và bảng điều khiển như mọi thay đổi kiện. */
export function useImportPackagesMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ packages, overrideReason }: { packages: readonly CargoPackage[]; overrideReason?: string }) => importPackages(tripId, packages, overrideReason),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useDeletePackageMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (packageId: string) => deletePackage(tripId, packageId),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}

export function useDuplicatePackageMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (packageId: string) => duplicateTripPackage(tripId, packageId),
    onSuccess: () => invalidateTrip(client, tripId),
  })
}
