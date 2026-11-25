import { useEffect, useLayoutEffect, useRef } from 'react'
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
 * nhìn, bước xếp (đưa mô phỏng về Xếp hàng), chế độ màu, mở danh sách kiện (`onOpenPackages`). Đăng ký một lần cho mỗi phương án; cầu nối
 * đọc trạng thái mới nhất qua ref (đang Chỉnh sửa thì cầu nối bỏ mọi lệnh), nên mỗi lần Planner vẽ lại không gỡ rồi đăng ký lại. Rời
 * Planner là gỡ. Mã phương án không phải số thì không đăng ký.
 */
export function usePlannerAssistant({ tripCode, planId, state, operations, editing, onOpenPackages }: {
  tripCode: string
  planId: string
  state: LoadPlanViewerState
  operations: OperationsState
  editing: boolean
  onOpenPackages: () => void
}) {
  const latest = useRef({ state, operations, editing, onOpenPackages })
  useLayoutEffect(() => { latest.current = { state, operations, editing, onOpenPackages } })
  useEffect(() => {
    const loadPlanId = Number(planId)
    if (!ASSISTANT_ON || planId.trim() === '' || !Number.isSafeInteger(loadPlanId)) return
    const now = () => latest.current
    const handle: ViewerHandle = {
      tripCode,
      loadPlanId,
      get selectedPackageCode() { return now().state.selected?.name ?? null },
      get mode() { return now().editing ? 'edit' : 'view' },
      get totalSteps() { return now().state.totalSteps },
      placementIdOf: (code) => placementIdOfCode(now().state.sceneModel.placements, code),
      select: (id) => {
        now().operations.pauseFollow()
        now().state.select(id)
      },
      setCameraPreset: (preset) => now().state.setCameraPreset(preset),
      setStep: (step) => {
        const { state: viewer, operations: ops } = now()
        ops.stop()
        if (ops.kind !== 'loading') ops.setKind('loading')
        viewer.setStep(step)
      },
      setColorMode: (mode) => now().state.setColorMode(mode),
      setLeftTab: (tab) => {
        now().state.setLeftTab(tab)
        now().onOpenPackages()
      },
    }
    registerViewer(handle)
    return () => unregisterViewer(handle)
  }, [tripCode, planId])
}
