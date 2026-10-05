import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { VerifyCandidate, VerifyCode, VerifyOutcome } from '@/components/PackageVerify'
import { useCan } from '@/features/auth/useCan'
import { loadingLabelPath } from '@/features/package-pool/packages-list'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { dataErrorMessage, useT, type TFunction } from '@/lib/i18n'
import { isMockDbError, type ManualConfirmInput, type MockDbError } from '@/lib/mock-db'
import { useConfirmLoadingByQrMutation, useConfirmLoadingManuallyMutation, useTripLabelsQuery } from './useWarehouseQueries'

/**
 * Đối chiếu kiện khi xếp (LM-104; ba mức từ FE-6-03, D-83). Kho chỉ nhận kiện của bước hiện tại. Quét hoặc gõ đúng mã thì kho ghi "đã
 * xếp" (kiện cuối tự hoàn tất xếp) và màn hiện lớp phủ "Đã xếp"; mã của kiện khác thì hộp vẫn mở và nói rõ kiện vừa đưa với kiện bước
 * này cần — không ghi gì. Nhãn không đọc được: xác nhận tay kiện của bước hiện tại kèm lý do — kho vẫn ghi "đã xếp" để làm tiếp, kèm
 * một xác nhận tay chờ điều phối viên duyệt; người có quyền in nhãn in lại được nhãn của kiện đó (mã QR giữ nguyên).
 */
export function useLoadingScan({ tripId, pending, onConfirmed }: {
  tripId: string
  /** Kiện chưa có kết quả, theo thứ tự xếp; phần tử đầu là kiện của bước hiện tại. */
  pending: readonly ScenePlacement[]
  /** Kho đã ghi kiện `id`; `nextStep` là bước kế tiếp (vắng khi vừa xếp kiện cuối); `manual`: ghi bằng xác nhận tay, còn chờ duyệt. */
  onConfirmed: (id: string, nextStep: number | undefined, manual?: boolean) => void
}) {
  const t = useT()
  const can = useCan()
  const labels = useTripLabelsQuery(tripId)
  const scan = useConfirmLoadingByQrMutation(tripId)
  const manual = useConfirmLoadingManuallyMutation(tripId)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<VerifyOutcome | null>(null)

  const labelById = useMemo(() => new Map((labels.data ?? []).map((label) => [label.packageInstanceId, label])), [labels.data])
  // Tên kiện lấy từ phương án của phiên (luôn có sẵn), nhãn chỉ bổ sung: nhãn tải riêng, quét trước khi nhãn về thì câu báo sai kiện
  // vẫn phải có tên (máy CI chậm từng in mã thay tên)
  const nameById = useMemo(() => {
    const names = new Map((labels.data ?? []).map((label) => [label.packageInstanceId, label.name]))
    for (const placement of pending) names.set(placement.id, placement.name)
    return names
  }, [labels.data, pending])

  // Xếp theo thứ tự: chỉ kiện của bước hiện tại xác nhận tay được
  const [current] = pending
  const canPrint = can('labels.print')
  const candidates = useMemo((): VerifyCandidate[] => {
    if (!current) return []
    const poolPackageId = labelById.get(current.id)?.poolPackageId
    return [{
      packageInstanceId: current.id,
      name: current.name,
      description: t('common.stop', { number: current.stop }),
      ...(canPrint && poolPackageId !== undefined ? { reprintHref: loadingLabelPath(poolPackageId, tripId) } : {}),
    }]
  }, [current, labelById, canPrint, tripId, t])

  function setOpenState(next: boolean) {
    setResult(null)
    setOpen(next)
  }

  function showError(failure: unknown) {
    setResult({ tone: 'error', message: scanErrorMessage(failure, t, nameById) })
  }

  function handleVerify(input: VerifyCode) {
    const nextStep = pending[1]?.step
    setResult(null)
    scan.mutate(input, {
      onSuccess: ({ packageInstanceId }) => {
        setOpen(false)
        onConfirmed(packageInstanceId, nextStep)
      },
      onError: showError,
    })
  }

  function handleManual(input: ManualConfirmInput) {
    const nextStep = pending[1]?.step
    setResult(null)
    manual.mutate(input, {
      onSuccess: ({ packageInstanceId }) => {
        setOpen(false)
        onConfirmed(packageInstanceId, nextStep, true)
        toast.warning(t('warehouse.scan.manualRecorded', { id: packageInstanceId }), { description: t('warehouse.scan.manualRecordedDescription') })
      },
      onError: showError,
    })
  }

  return { open, setOpen: setOpenState, candidates, result, pending: scan.isPending || manual.isPending, handleVerify, handleManual }
}

/** Đưa sai kiện: câu riêng nêu cả hai mã kèm tên kiện; lỗi khác của kho dùng câu chung (`dataErrors`). */
export function scanErrorMessage(error: unknown, t: TFunction, nameById: ReadonlyMap<string, string>): string {
  if (isMockDbError(error) && error.code === 'WRONG_PACKAGE_SCANNED') {
    const { expected, scanned } = (error as MockDbError<'WRONG_PACKAGE_SCANNED'>).params
    return t('warehouse.scan.wrongPackage', {
      scanned,
      scannedName: nameById.get(scanned) ?? scanned,
      expected,
      expectedName: nameById.get(expected) ?? expected,
    })
  }
  return dataErrorMessage(error, t)
}
