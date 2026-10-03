import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { VerifyCandidate, VerifyCode, VerifyOutcome } from '@/components/PackageVerify'
import { dataErrorMessage, useT, type TFunction } from '@/lib/i18n'
import { isMockDbError, type ManualConfirmInput, type MockDbError, type TripLabel } from '@/lib/mock-db'
import type { DeliveryView } from './delivery-progress'
import type { StopDelivery } from './driver-plan'
import { useConfirmUnloadByQrMutation, useConfirmUnloadManuallyMutation, useDriverTripLabelsQuery } from './useDriverQueries'

/**
 * Đối chiếu kiện khi dỡ (LM-104; ba mức từ FE-6-03, D-83). Kho chỉ nhận kiện của điểm đang giao: quét hoặc gõ đúng mã thì ghi "đã
 * dỡ" kèm cách đối chiếu và hộp ở lại để làm kiện kế tiếp — dòng kết quả nói kiện vừa dỡ; dỡ hết kiện thì hộp tự đóng. Kiện của điểm
 * khác: nói kiện đó thuộc điểm nào, không ghi gì. Nhãn không đọc được: xác nhận tay một kiện chưa dỡ của điểm này kèm lý do — ghi "đã
 * dỡ" kèm xác nhận tay chờ điều phối viên duyệt; còn chờ thì chưa hoàn tất điểm giao được (FE-6-04).
 */
export function useUnloadScan(tripId: string, view: DeliveryView | undefined, stops: readonly StopDelivery[]) {
  const t = useT()
  const labels = useDriverTripLabelsQuery(tripId)
  const scan = useConfirmUnloadByQrMutation(tripId)
  const manual = useConfirmUnloadManuallyMutation(tripId)
  const [open, setOpen] = useState(false)
  const [result, setResult] = useState<VerifyOutcome | null>(null)

  const labelById = useMemo(() => new Map((labels.data ?? []).map((label) => [label.packageInstanceId, label])), [labels.data])
  // Kiện xác nhận tay được: kiện của điểm này chưa dỡ, chưa có sự cố, theo thứ tự dỡ
  const candidates = useMemo(
    () => (view?.items ?? []).flatMap(({ item, unloaded, issue }): VerifyCandidate[] =>
      unloaded || issue ? [] : [{ packageInstanceId: item.id, name: item.name, description: t('driver.item.order', { order: item.unloadingOrder }) }]),
    [view, t],
  )

  function setOpenState(next: boolean) {
    setResult(null)
    setOpen(next)
  }

  function showError(failure: unknown) {
    setResult({ tone: 'error', message: unloadScanErrorMessage(failure, t, labelById, stops) })
  }

  /** Kho đã ghi kiện `id`: nói kết quả; vừa xong kiện cuối còn chờ dỡ của điểm thì đóng hộp — không còn gì để đối chiếu. */
  function recorded(id: string, waiting: ReadonlySet<string>) {
    const name = view?.items.find((entry) => entry.item.id === id)?.item.name ?? labelById.get(id)?.name ?? ''
    setResult({ tone: 'success', message: t('driver.scan.lastUnloaded', { id, name }) })
    if ([...waiting].every((item) => item === id)) setOpenState(false)
  }

  const waitingIds = () => new Set((view?.items ?? []).filter((entry) => !entry.unloaded && !entry.issue).map((entry) => entry.item.id))

  function handleVerify(input: VerifyCode) {
    if (!view) return
    const waiting = waitingIds()
    setResult(null)
    scan.mutate({ stopNumber: view.stop.number, ...input }, {
      onSuccess: ({ packageInstanceId }) => {
        toast.success(t('driver.scan.unloaded', { id: packageInstanceId }))
        recorded(packageInstanceId, waiting)
      },
      onError: showError,
    })
  }

  function handleManual(input: ManualConfirmInput) {
    if (!view) return
    const waiting = waitingIds()
    setResult(null)
    manual.mutate({ stopNumber: view.stop.number, input }, {
      onSuccess: ({ packageInstanceId }) => {
        toast.warning(t('driver.scan.manualRecorded', { id: packageInstanceId }), { description: t('driver.scan.manualRecordedDescription') })
        recorded(packageInstanceId, waiting)
      },
      onError: showError,
    })
  }

  return { open, setOpen: setOpenState, candidates, result, pending: scan.isPending || manual.isPending, handleVerify, handleManual }
}

/** Kiện của điểm khác: câu riêng nêu điểm đúng của kiện; lỗi khác của kho dùng câu chung (`dataErrors`). */
function unloadScanErrorMessage(
  error: unknown,
  t: TFunction,
  labelById: ReadonlyMap<string, TripLabel>,
  stops: readonly StopDelivery[],
): string {
  if (isMockDbError(error) && error.code === 'QR_WRONG_STOP') {
    const { packageInstanceId, stopNumber } = (error as MockDbError<'QR_WRONG_STOP'>).params
    return t('driver.scan.wrongStop', {
      id: packageInstanceId,
      name: labelById.get(packageInstanceId)?.name ?? packageInstanceId,
      stop: stopNumber,
      stopName: stops.find((stop) => stop.number === stopNumber)?.name ?? '',
    })
  }
  return dataErrorMessage(error, t)
}
