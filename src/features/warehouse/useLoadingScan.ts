import { useMemo, useState } from 'react'
import type { QrScanOption } from '@/components/QrScanDialog'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { dataErrorMessage, useT, type TFunction } from '@/lib/i18n'
import { isMockDbError, type MockDbError, type TripLabel } from '@/lib/mock-db'
import { useConfirmLoadingByQrMutation, useTripLabelsQuery } from './useWarehouseQueries'

/**
 * Quét QR khi xếp (luồng 5 Review 1, LM-104). Kho chỉ nhận kiện của bước hiện tại: quét đúng thì kho ghi "đã xếp" như nút xác nhận
 * (kiện cuối tự hoàn tất xếp) và màn hiện lớp phủ "Đã xếp"; quét kiện khác thì hộp thoại vẫn mở và nói rõ kiện vừa quét với kiện
 * bước này cần — không ghi gì. Danh sách chọn tay là các kiện chưa xếp theo thứ tự xếp, cho khi nhãn rách hoặc không có camera.
 */
export function useLoadingScan({ tripId, pending, onConfirmed }: {
  tripId: string
  /** Kiện chưa có kết quả, theo thứ tự xếp; phần tử đầu là kiện của bước hiện tại. */
  pending: readonly ScenePlacement[]
  /** Kho đã ghi kiện `id`; `nextStep` là bước kế tiếp (vắng khi vừa xếp kiện cuối). */
  onConfirmed: (id: string, nextStep: number | undefined) => void
}) {
  const t = useT()
  const labels = useTripLabelsQuery(tripId)
  const scan = useConfirmLoadingByQrMutation(tripId)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const labelById = useMemo(() => new Map((labels.data ?? []).map((label) => [label.packageInstanceId, label])), [labels.data])
  const options = useMemo(
    () => pending.flatMap((placement): QrScanOption[] => {
      const label = labelById.get(placement.id)
      return label
        ? [{ token: label.qrToken, label: placement.id, description: t('warehouse.scan.optionDescription', { name: placement.name, stop: placement.stop }) }]
        : []
    }),
    [pending, labelById, t],
  )

  function setOpenState(next: boolean) {
    setError(null)
    setOpen(next)
  }

  function handleScan(token: string) {
    const nextStep = pending[1]?.step
    setError(null)
    scan.mutate(token, {
      onSuccess: (result) => {
        setOpen(false)
        onConfirmed(result.packageInstanceId, nextStep)
      },
      onError: (failure) => setError(scanErrorMessage(failure, t, labelById)),
    })
  }

  return { open, setOpen: setOpenState, options, error, pending: scan.isPending, handleScan }
}

/** Quét sai kiện: câu riêng nêu cả hai mã kèm tên kiện; lỗi khác của kho dùng câu chung (`dataErrors`). */
export function scanErrorMessage(error: unknown, t: TFunction, labelById: ReadonlyMap<string, TripLabel>): string {
  if (isMockDbError(error) && error.code === 'QR_WRONG_PACKAGE') {
    const { expected, scanned } = (error as MockDbError<'QR_WRONG_PACKAGE'>).params
    return t('warehouse.scan.wrongPackage', {
      scanned,
      scannedName: labelById.get(scanned)?.name ?? scanned,
      expected,
      expectedName: labelById.get(expected)?.name ?? expected,
    })
  }
  return dataErrorMessage(error, t)
}
