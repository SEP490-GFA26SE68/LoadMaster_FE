import { useEffect } from 'react'
import { registerViewer, unregisterViewer, type ViewerHandle } from '@/features/marketing/assistant/viewer-bridge'
import { usesBackend } from '@/lib/backend-config'
import type { OperationsState } from './operations/useOperations'
import type { LoadPlanViewerState } from './useLoadPlanViewer'

const ASSISTANT_ON = usesBackend('assistant')

/** Mã kiện → mã placement: so không phân biệt hoa thường, chỉ khi phương án có đúng một kiện mang mã đó. */
export function placementIdOfCode(placements: readonly { readonly id: string; readonly name: string }[], code: string): string | null {
  const wanted = code.toLowerCase()
  const matches = placements.filter((placement) => placement.name.toLowerCase() === wanted)
  return matches.length === 1 ? matches[0]!.id : null
}

/**
 * Đăng ký Planner bản máy chủ với trợ lý (`viewer-bridge.ts`) khi nhóm `assistant` nối máy chủ: câu hỏi gửi kèm chuyến, mã số phương án và
 * kiện đang chọn; lệnh giao diện của câu trả lời đi qua các hàm của Planner — chọn kiện (theo mã in trên nhãn, tên của placement), góc
 * nhìn, bước xếp (đưa mô phỏng về Xếp hàng), chế độ màu, mở danh sách kiện (`onOpenPackages`). Đăng ký lại sau mỗi lần vẽ nên cầu nối luôn
 * đọc trạng thái mới nhất (đang Chỉnh sửa thì cầu nối bỏ mọi lệnh); rời Planner là gỡ. Mã phương án không phải số thì không đăng ký.
 */
export function usePlannerAssistant({ tripCode, planId, state, operations, editing, onOpenPackages }: {
  tripCode: string
  planId: string
  state: LoadPlanViewerState
  operations: OperationsState
  editing: boolean
  onOpenPackages: () => void
}) {
  useEffect(() => {
    const loadPlanId = Number(planId)
    if (!ASSISTANT_ON || planId.trim() === '' || !Number.isSafeInteger(loadPlanId)) return
    const handle: ViewerHandle = {
      tripCode,
      loadPlanId,
      selectedPackageCode: state.selected?.name ?? null,
      mode: editing ? 'edit' : 'view',
      totalSteps: state.totalSteps,
      placementIdOf: (code) => placementIdOfCode(state.sceneModel.placements, code),
      select: (id) => {
        operations.pauseFollow()
        state.select(id)
      },
      setCameraPreset: state.setCameraPreset,
      setStep: (step) => {
        operations.stop()
        if (operations.kind !== 'loading') operations.setKind('loading')
        state.setStep(step)
      },
      setColorMode: state.setColorMode,
      setLeftTab: (tab) => {
        state.setLeftTab(tab)
        onOpenPackages()
      },
    }
    registerViewer(handle)
    return () => unregisterViewer(handle)
  })
}
