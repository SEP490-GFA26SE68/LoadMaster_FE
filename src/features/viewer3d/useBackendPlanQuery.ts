import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PlanObjective } from '@/domain/models'
import {
  approveBackendEdits,
  approveBackendLoadPlan,
  fetchBackendPlanSource,
  pinBackendPlacement,
  rerunBackendLoadPlan,
  unpinBackendPlacement,
  type BackendPlacementEdit,
} from './viewer-backend-api'

/** Nguồn của Planner bản máy chủ, dưới khoá của chuyến: duyệt, sửa chuyến hay chạy lại tối ưu đều làm mới nó. */
export function useBackendPlanQuery(tripCode: string, planId: string | undefined) {
  return useQuery({
    queryKey: ['trips', tripCode, 'backend-plan', planId ?? 'current'],
    queryFn: () => fetchBackendPlanSource(tripCode, planId),
    enabled: tripCode !== '',
    staleTime: 0,
  })
}

export function useApproveBackendPlanMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (planId: string) => approveBackendLoadPlan(planId),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['trips'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ]),
  })
}

/** Duyệt bản chỉnh tay: máy chủ lưu một bản duyệt mới, nên làm mới mọi khoá của chuyến. */
export function useApproveBackendEditsMutation(planId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ edits, pinnedPlacementIds }: { edits: readonly BackendPlacementEdit[]; pinnedPlacementIds?: readonly string[] }) =>
      approveBackendEdits(planId, edits, pinnedPlacementIds),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['trips'] }),
      client.invalidateQueries({ queryKey: ['dashboard'] }),
    ]),
  })
}

/** Ghim / bỏ ghim một placement; xong thì đọc lại phương án đang xem (chip "Đã ghim", số kiện ghim). */
export function useTogglePinMutation(tripCode: string, planId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ placementId, pinned }: { placementId: string; pinned: boolean }) =>
      pinned ? pinBackendPlacement(planId, placementId) : unpinBackendPlacement(planId, placementId),
    // Lỗi cũng đọc lại: máy chủ từ chối `TRIP_LOCKED` khi chuyến vừa rời Đã lập kế hoạch — Planner khoá theo trạng thái mới
    onSettled: () => client.invalidateQueries({ queryKey: ['trips', tripCode, 'backend-plan'] }),
  })
}

/** Chạy lại giữ ghim: một phương án mới của chuyến và một credit, nên làm mới mọi khoá của chuyến và của gói cước. */
export function useRerunBackendPlanMutation(planId: string, objective: PlanObjective | null) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: () => rerunBackendLoadPlan(planId, objective),
    onSuccess: () => Promise.all([
      client.invalidateQueries({ queryKey: ['trips'] }),
      client.invalidateQueries({ queryKey: ['billing'] }),
    ]),
    // Chuyến vừa rời Đã lập kế hoạch (`TRIP_LOCKED`): đọc lại để Planner khoá theo trạng thái mới
    onError: () => client.invalidateQueries({ queryKey: ['trips'] }),
  })
}
