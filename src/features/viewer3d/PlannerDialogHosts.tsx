import { useMemo } from 'react'
import { ChangeVehicleDialog } from '@/features/trips/ChangeVehicleDialog'
import { useT } from '@/lib/i18n'
import { ApprovePlanDialog } from './ApprovePlanDialog'
import type { useViewerApproval } from './approval/useViewerApproval'
import { useDialogHost, type DialogOpener } from './dialog-opener'
import { operationApprovalChecks } from './operations/approval-checks'
import type { ScenePlacement, ViewerSceneModel } from './scene-input'

/** Hộp "Đổi xe" của Planner (FE-5b-08): state mở nằm ở đây, mở / đóng không vẽ lại phiên Planner. */
export function ChangeVehicleHost({ opener, tripId }: { opener: DialogOpener; tripId: string }) {
  const [open, setOpen] = useDialogHost(opener)
  return <ChangeVehicleDialog tripId={tripId} open={open} onOpenChange={setOpen} />
}

/** Hộp Duyệt của Planner kho mẫu: state mở và các mục kiểm (chỉ tính khi đang mở) nằm ở đây. */
export function ApprovePlanHost({ opener, plan, approval, placements, poseEdits, onShowUnloading }: {
  opener: DialogOpener
  plan: ViewerSceneModel
  approval: ReturnType<typeof useViewerApproval>
  placements: readonly ScenePlacement[]
  poseEdits: boolean
  /** Sau khi hộp đã đóng: về chế độ Xem và mở mô phỏng dỡ hàng để xem kiện chắn lối. */
  onShowUnloading: () => void
}) {
  const t = useT()
  const [open, setOpen] = useDialogHost(opener)
  const checks = useMemo(() => open ? operationApprovalChecks(placements, poseEdits, t) : [], [open, placements, poseEdits, t])
  if (!plan.metrics || !approval.approval) return null
  return (
    <ApprovePlanDialog
      open={open}
      onOpenChange={setOpen}
      metrics={plan.metrics}
      canSubmit={approval.canSubmit}
      approval={approval.approval}
      deadlines={approval.deadlines}
      checks={checks}
      pending={approval.pending}
      onConfirm={(force) => approval.confirm(() => setOpen(false), { force })}
      isMockResult={plan.isMockResult}
      lifoOff={plan.engineInput?.settings.enforceLifo === false}
      onShowUnloading={() => { setOpen(false); onShowUnloading() }}
    />
  )
}
