import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveTrialRequest,
  createTrialRequest,
  listTrialRequests,
  rejectTrialRequest,
  type ApproveTrialAccountRequest,
  type CreateTrialAccountRequest,
  type ListTrialRequestsParams,
  type RejectTrialAccountRequest,
} from './trial-requests-api'

export function useTrialRequestsQuery(params: ListTrialRequestsParams = {}) {
  return useQuery({
    queryKey: ['trial-requests', params],
    queryFn: () => listTrialRequests(params),
    staleTime: 0,
  })
}

export function useCreateTrialRequestMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTrialAccountRequest) => createTrialRequest(data),
    onSuccess: () => Promise.all(['trial-requests', 'contacts'].map((key) => client.invalidateQueries({ queryKey: [key] }))),
  })
}

export function useApproveTrialRequestMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: ApproveTrialAccountRequest }) =>
      approveTrialRequest(id, data),
    onSuccess: () => Promise.all(['trial-requests', 'companies', 'contacts'].map((key) => client.invalidateQueries({ queryKey: [key] }))),
  })
}

export function useRejectTrialRequestMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: number | string; data: RejectTrialAccountRequest }) =>
      rejectTrialRequest(id, data),
    onSuccess: () => Promise.all(['trial-requests', 'contacts'].map((key) => client.invalidateQueries({ queryKey: [key] }))),
  })
}
