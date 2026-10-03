import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { LoadingProgress } from '@/lib/mock-db'
import { loadingProgress } from './loading-session'
import { useRecordLoadingStepMutation } from './useWarehouseQueries'

/** Thời gian tối thiểu hiện lớp phủ "Đã xếp" trước khi sang kiện kế tiếp. */
const CONFIRMED_OVERLAY_MS = 1200

type Overlay = { readonly id: string; readonly nextStep: number | undefined; readonly manual: boolean }

/**
 * Phiên xếp hàng tại kho (LM-086): kiện hiện tại là kiện chưa có kết quả đầu tiên theo `loadingOrder`, đọc từ tiến độ trong kho — mở
 * lại màn là tiếp tục đúng chỗ (D-47). Xác nhận ghi "đã xếp" rồi hiện lớp phủ xanh tới khi vừa hết 1,2 giây vừa ghi xong; kiện
 * thiếu ghi "thiếu". Kiện cuối có kết quả thì kho tự hoàn tất xếp (`warehouse-api`). Ghi lỗi: toast nói lỗi, kiện hiện tại giữ nguyên.
 */
export function useLoadingSession(tripId: string, placements: readonly ScenePlacement[], loading: LoadingProgress | undefined) {
  const t = useT()
  const progress = useMemo(() => loadingProgress(placements, loading), [placements, loading])
  const record = useRecordLoadingStepMutation(tripId)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [holding, setHolding] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  const busy = holding || record.isPending

  function showError(error: unknown) {
    toast.error(dataErrorMessage(error, t))
  }

  /**
   * Hiện lớp phủ "Đã xếp `id`" tối thiểu 1,2 giây — dùng chung cho nút xác nhận và hộp đối chiếu kiện. `manual`: kiện vừa ghi bằng xác
   * nhận tay, còn chờ điều phối viên duyệt.
   */
  function celebrate(id: string, nextStep: number | undefined, manual = false) {
    setOverlay({ id, nextStep, manual })
    setHolding(true)
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setHolding(false)
    }, CONFIRMED_OVERLAY_MS)
  }

  function confirm() {
    const current = progress.current
    if (!current || busy) return
    celebrate(current.id, progress.next?.step)
    record.mutate({ packageInstanceId: current.id, outcome: 'loaded' }, { onError: showError })
  }

  /** Ghi kiện `id` thiếu ở kho; `true` khi kho đã ghi. */
  async function reportMissing(id: string): Promise<boolean> {
    // Lớp phủ chỉ dành cho "đã xếp": lần ghi thiếu không được làm hiện lại lớp phủ của kiện xác nhận trước đó
    setOverlay(null)
    try {
      await record.mutateAsync({ packageInstanceId: id, outcome: 'missing' })
      toast.warning(t('warehouse.missingRecorded', { id }), { description: t('warehouse.missingRecordedDescription') })
      return true
    } catch (error) {
      showError(error)
      return false
    }
  }

  return {
    ...progress,
    busy,
    /** Lớp phủ "Đã xếp": giữ tới khi vừa hết thời gian tối thiểu vừa ghi xong, để không lộ lại kiện vừa xác nhận. */
    overlay: overlay !== null && busy ? overlay : null,
    recording: record.isPending,
    confirm,
    celebrate,
    reportMissing,
  }
}
