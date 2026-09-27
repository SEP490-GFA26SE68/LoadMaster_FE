import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { QrScanOption } from '@/components/QrScanDialog'
import { dataErrorMessage, useT, type TFunction } from '@/lib/i18n'
import { isMockDbError, type MockDbError, type TripLabel } from '@/lib/mock-db'
import type { DeliveryView } from './delivery-progress'
import type { StopDelivery } from './driver-plan'
import { useConfirmUnloadByQrMutation, useDriverTripLabelsQuery } from './useDriverQueries'

/**
 * Quét QR khi dỡ (luồng 5 Review 1, LM-104). Kho chỉ nhận kiện của điểm đang giao: quét đúng thì ghi "đã dỡ" (kèm dấu đã xác nhận
 * bằng QR) và hộp thoại ở lại để quét kiện kế tiếp — mô tả hộp thoại nói tiến độ của điểm và kiện vừa dỡ; dỡ hết kiện thì hộp thoại
 * tự đóng. Kiện của điểm khác: nói kiện đó thuộc điểm nào, không ghi gì. Danh sách chọn tay là kiện của điểm này chưa dỡ, theo thứ tự dỡ.
 */
export function useUnloadScan(tripId: string, view: DeliveryView | undefined, stops: readonly StopDelivery[]) {
  const t = useT()
  const labels = useDriverTripLabelsQuery(tripId)
  const scan = useConfirmUnloadByQrMutation(tripId)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [last, setLast] = useState<string | null>(null)

  const labelById = useMemo(() => new Map((labels.data ?? []).map((label) => [label.packageInstanceId, label])), [labels.data])
  const options = useMemo(
    () => (view?.items ?? []).flatMap(({ item, unloaded, issue }): QrScanOption[] => {
      const label = labelById.get(item.id)
      if (!label || unloaded || issue) return []
      return [{ token: label.qrToken, label: item.id, description: t('driver.scan.optionDescription', { name: item.name, order: item.unloadingOrder }) }]
    }),
    [view, labelById, t],
  )

  function setOpenState(next: boolean) {
    setError(null)
    setLast(null)
    setOpen(next)
  }

  function handleScan(token: string) {
    if (!view) return
    const stopNumber = view.stop.number
    const waiting = new Set(view.items.filter((entry) => !entry.unloaded && !entry.issue).map((entry) => entry.item.id))
    setError(null)
    scan.mutate({ stopNumber, token }, {
      onSuccess: ({ packageInstanceId }) => {
        setLast(packageInstanceId)
        toast.success(t('driver.scan.unloaded', { id: packageInstanceId }))
        // Vừa quét kiện cuối còn chờ dỡ của điểm: không còn gì để quét
        waiting.delete(packageInstanceId)
        if (waiting.size === 0) setOpenState(false)
      },
      onError: (failure) => setError(unloadScanErrorMessage(failure, t, labelById, stops)),
    })
  }

  const lastName = last === null ? undefined : labelById.get(last)?.name
  return { open, setOpen: setOpenState, options, error, pending: scan.isPending, handleScan, last, lastName }
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
