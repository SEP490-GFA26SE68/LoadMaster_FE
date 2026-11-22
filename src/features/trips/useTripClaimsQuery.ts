import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { approveTripClaim, fetchPendingTripClaims, fetchTripClaims, rejectTripClaim } from './trip-claims-api'

export const PENDING_TRIP_CLAIMS_QUERY_KEY = ['trips', 'claims', 'pending'] as const

/** Phiếu của chuyến máy chủ, cùng nhánh khóa với chi tiết chuyến để mutation làm mới đúng dữ liệu. */
export function useTripClaimsQuery(tripId: string) {
  return useQuery({
    queryKey: ['trips', tripId, 'claims'],
    queryFn: () => fetchTripClaims(tripId),
    enabled: tripId !== '',
    staleTime: 0,
  })
}

/** Hàng đợi phiếu PENDING của cả công ty, chỉ dùng khi nhóm chuyến đã nối backend. */
export function usePendingTripClaimsQuery() {
  return useQuery({
    queryKey: PENDING_TRIP_CLAIMS_QUERY_KEY,
    queryFn: () => fetchPendingTripClaims(),
    staleTime: 0,
  })
}

/** Duyệt phiếu từ hàng đợi và làm mới danh sách lẫn hai truy vấn của chuyến liên quan. */
export function useApprovePendingTripClaimMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ tripId, claimId }: { tripId: string; claimId: string }) => approveTripClaim(tripId, claimId),
    onSuccess: (_data, { tripId }) => Promise.all([
      client.invalidateQueries({ queryKey: PENDING_TRIP_CLAIMS_QUERY_KEY }),
      client.invalidateQueries({ queryKey: ['trips', tripId, 'backend-detail'] }),
      client.invalidateQueries({ queryKey: ['trips', tripId, 'claims'] }),
    ]),
  })
}

/** Từ chối từ hàng đợi; làm mới các dữ liệu của chuyến đó sau khi máy chủ chấp nhận. */
export function useRejectPendingTripClaimMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ tripId, claimId, reason }: { tripId: string; claimId: string; reason: string }) => rejectTripClaim(tripId, claimId, reason),
    onSuccess: (_data, { tripId }) => Promise.all([
      client.invalidateQueries({ queryKey: PENDING_TRIP_CLAIMS_QUERY_KEY }),
      client.invalidateQueries({ queryKey: ['trips', tripId, 'backend-detail'] }),
      client.invalidateQueries({ queryKey: ['trips', tripId, 'claims'] }),
    ]),
  })
}

/** Duyệt gán tài xế vào chuyến: tải lại chi tiết chuyến và danh sách phiếu sau khi máy chủ thành công. */
export function useApproveTripClaimMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (claimId: string) => approveTripClaim(tripId, claimId),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: PENDING_TRIP_CLAIMS_QUERY_KEY }),
      client.invalidateQueries({ queryKey: ['trips', tripId, 'backend-detail'] }),
      client.invalidateQueries({ queryKey: ['trips', tripId, 'claims'] }),
    ]),
  })
}

/** Từ chối chỉ đổi danh sách phiếu. */
export function useRejectTripClaimMutation(tripId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ claimId, reason }: { claimId: string; reason: string }) => rejectTripClaim(tripId, claimId, reason),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: PENDING_TRIP_CLAIMS_QUERY_KEY }),
      client.invalidateQueries({ queryKey: ['trips', tripId, 'claims'] }),
    ]),
  })
}
