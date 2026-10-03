import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { VerifyCandidate, VerifyCode, VerifyOutcome } from '@/components/PackageVerify'
import { useCan } from '@/features/auth/useCan'
import { loadingLabelPath } from '@/features/package-pool/packages-list'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { ManualConfirmInput } from '@/lib/mock-db'
import { useConfirmStagingByQrMutation, useConfirmStagingManuallyMutation, useTripLabelsQuery } from './useWarehouseQueries'

/**
 * Đối chiếu kiện khi soạn hàng (FE-6-02, D-82, D-83): kho nhận mọi kiện chưa soạn của chuyến, không cần thứ tự. Quét hoặc gõ đúng mã
 * thì kiện sang "đã soạn" và hộp ở lại để làm kiện kế tiếp — dòng kết quả nói kiện vừa soạn; quét lại kiện đã soạn chỉ được báo "đã
 * soạn", kho không ghi gì; mã không thuộc chuyến thì báo lỗi của kho. Soạn hết thì hộp tự đóng. Nhãn không đọc được: xác nhận tay một
 * kiện chưa soạn kèm lý do — ghi "đã soạn" để làm tiếp, chờ điều phối viên duyệt; người có quyền in nhãn in lại được nhãn của kiện đó.
 */
export function useStagingScan({ tripId, placements, pending }: {
  tripId: string
  /** Mọi kiện của phương án: tên kiện cho dòng kết quả. */
  placements: readonly ScenePlacement[]
  /** Kiện chưa soạn. */
  pending: readonly ScenePlacement[]
}) {
  const t = useT()
  const can = useCan()
  const labels = useTripLabelsQuery(tripId)
  const scan = useConfirmStagingByQrMutation(tripId)
  const manual = useConfirmStagingManuallyMutation(tripId)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<VerifyOutcome | null>(null)

  const nameById = useMemo(() => new Map(placements.map((placement) => [placement.id, placement.name])), [placements])
  const canPrint = can('labels.print')
  const candidates = useMemo((): VerifyCandidate[] => {
    const poolIdOf = new Map((labels.data ?? []).map((label) => [label.packageInstanceId, label.poolPackageId]))
    return pending.map((placement) => {
      const poolPackageId = poolIdOf.get(placement.id)
      return {
        packageInstanceId: placement.id,
        name: placement.name,
        description: t('common.stop', { number: placement.stop }),
        ...(canPrint && poolPackageId !== undefined ? { reprintHref: loadingLabelPath(poolPackageId, tripId) } : {}),
      }
    })
  }, [pending, labels.data, canPrint, tripId, t])

  function setOpenState(next: boolean) {
    setResult(null)
    setOpen(next)
  }

  function showError(failure: unknown) {
    setResult({ tone: 'error', message: dataErrorMessage(failure, t) })
  }

  /** Kho đã trả lời về kiện `id`: nói kết quả; vừa soạn kiện cuối còn chờ thì đóng hộp — màn sang bước xếp. */
  function recorded(id: string, key: 'lastStaged' | 'alreadyStaged', waiting: ReadonlySet<string>) {
    setResult({ tone: 'success', message: t(`warehouse.staging.${key}`, { id, name: nameById.get(id) ?? '' }) })
    if (waiting.size > 0 && [...waiting].every((item) => item === id)) setOpenState(false)
  }

  function handleVerify(input: VerifyCode) {
    const waiting = new Set(pending.map((placement) => placement.id))
    setResult(null)
    scan.mutate(input, {
      onSuccess: ({ packageInstanceId, alreadyStaged }) => recorded(packageInstanceId, alreadyStaged ? 'alreadyStaged' : 'lastStaged', waiting),
      onError: showError,
    })
  }

  function handleManual(input: ManualConfirmInput) {
    const waiting = new Set(pending.map((placement) => placement.id))
    setResult(null)
    manual.mutate(input, {
      onSuccess: ({ packageInstanceId }) => {
        toast.warning(t('warehouse.staging.manualRecorded', { id: packageInstanceId }), { description: t('warehouse.scan.manualRecordedDescription') })
        recorded(packageInstanceId, 'lastStaged', waiting)
      },
      onError: showError,
    })
  }

  return { open, setOpen: setOpenState, candidates, result, pending: scan.isPending || manual.isPending, handleVerify, handleManual }
}
