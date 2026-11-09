import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  approveTrialRequest,
  listTrialRequests,
  managerApproveTrialRequest,
  managerRejectTrialRequest,
  rejectTrialRequest,
  type ManagerApprovePayload,
  type TrialApproval,
} from './trial-requests-api'

/** Yêu cầu dùng thử của nền tảng; `staleTime: 0` — yêu cầu mới đến từ màn Liên hệ của khách. Duyệt tạo công ty nên làm mới cả màn Công ty. */
const KEY = ['trial-requests'] as const

export function useTrialRequestsQuery() {
  return useQuery({ queryKey: KEY, queryFn: listTrialRequests, staleTime: 0 })
}

export function useManagerApproveTrialRequestMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: string; payload?: ManagerApprovePayload } | string) => {
      const id = typeof args === 'string' ? args : args.id
      const payload = typeof args === 'string' ? undefined : args.payload
      return managerApproveTrialRequest(id, payload)
    },
    onSuccess: () => Promise.all([KEY, ['contacts']].map((queryKey) => client.invalidateQueries({ queryKey }))),
  })
}

export function useManagerRejectTrialRequestMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => managerRejectTrialRequest(id, reason),
    onSuccess: () => Promise.all([KEY, ['contacts']].map((queryKey) => client.invalidateQueries({ queryKey }))),
  })
}

export function useApproveTrialRequestMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, approval }: { id: string; approval: TrialApproval }) => approveTrialRequest(id, approval),
    onSuccess: () => Promise.all([KEY, ['companies'], ['contacts'], ['billing']].map((queryKey) => client.invalidateQueries({ queryKey }))),
  })
}

export function useRejectTrialRequestMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectTrialRequest(id, reason),
    onSuccess: () => Promise.all([KEY, ['contacts']].map((queryKey) => client.invalidateQueries({ queryKey }))),
  })
}
