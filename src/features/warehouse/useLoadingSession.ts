import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { LoadingProgress } from '@/lib/mock-db'
import { loadingProgress } from './loading-session'
import { useReportDamagedMutation } from './useWarehouseQueries'

/** Thời gian tối thiểu hiện lớp phủ "Đã xếp" trước khi sang kiện kế tiếp. */
const CONFIRMED_OVERLAY_MS = 1200

type Overlay = { readonly id: string; readonly nextStep: number | undefined; readonly manual: boolean }

/**
 * Bước xếp tại kho (LM-086, FE-6-05): kiện hiện tại là kiện chưa có kết quả đầu tiên theo `loadingOrder`, đọc từ tiến độ trong kho — mở
 * lại màn là tiếp tục đúng chỗ (D-47). Kiện chỉ được ghi "đã xếp" qua hộp đối chiếu (`useLoadingScan`); ghi xong màn hiện lớp phủ xanh
 * tối thiểu 1,2 giây. Kiện hỏng thì báo hỏng: kho bỏ kiện lại, hoặc đưa chuyến về Đã lập kế hoạch khi có kiện tựa lên nó. Kiện cuối có
 * kết quả thì kho tự hoàn tất xếp (`warehouse-api`).
 */
export function useLoadingSession(tripId: string, placements: readonly ScenePlacement[], loading: LoadingProgress | undefined) {
  const t = useT()
  const progress = useMemo(() => loadingProgress(placements, loading), [placements, loading])
  const damaged = useReportDamagedMutation(tripId)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [holding, setHolding] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
  }, [])

  /**
   * Hiện lớp phủ "Đã xếp `id`" tối thiểu 1,2 giây sau khi hộp đối chiếu ghi xong. `manual`: kiện vừa ghi bằng xác nhận tay, còn chờ
   * điều phối viên duyệt.
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

  /** Báo kiện `id` hỏng; `true` khi kho đã ghi. Toast nói kiện bị bỏ lại và xếp tiếp, hay chuyến phải xếp lại theo phương án mới. */
  async function reportDamaged(id: string): Promise<boolean> {
    // Lớp phủ chỉ dành cho "đã xếp": không để lần báo hỏng làm hiện lại lớp phủ của kiện trước
    setOverlay(null)
    try {
      const trip = await damaged.mutateAsync(id)
      if (trip.phase === 'planning') toast.warning(t('warehouse.damaged.replan', { id }), { description: t('warehouse.damaged.replanDescription') })
      else toast.warning(t('warehouse.damaged.recorded', { id }), { description: t('warehouse.damaged.recordedDescription') })
      return true
    } catch (error) {
      toast.error(dataErrorMessage(error, t))
      return false
    }
  }

  return {
    ...progress,
    busy: holding || damaged.isPending,
    /** Lớp phủ "Đã xếp": giữ tới khi hết thời gian tối thiểu, để không lộ lại kiện vừa xác nhận. */
    overlay: overlay !== null && holding ? overlay : null,
    reporting: damaged.isPending,
    celebrate,
    reportDamaged,
  }
}
