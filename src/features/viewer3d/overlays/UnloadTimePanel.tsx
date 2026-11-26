import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { formatDuration } from '../operations/handling-format'
import type { PlannerTiming } from '../operations/handling-schedule'
import { HandlingAssumptions } from '../operations/HandlingAssumptions'
import { MUTED, StopMark } from '../panels/scene-ui'
import type { SceneStop } from '../scene-input'
import { IndicatorCard } from './IndicatorCard'

/**
 * Thời gian dỡ ước tính của từng điểm giao, đặt cạnh mức hạn ở hộp Chi tiết (Spec vật lý 10.2): tổng thời gian bê các kiện của điểm
 * ra cửa sau theo thứ tự dỡ của phương án, cộng hai lượt bê cho mỗi kiện giao sau chắn lối thẳng ra cửa. Giả định bốc tay chưa có số đo
 * của công ty nên thẻ mang nhãn "Ước tính" và liệt kê giả định ngay trong thẻ (máy cảm ứng không có tooltip của thanh phát).
 */
export function UnloadTimePanel({ stops, timing }: { stops: readonly SceneStop[]; timing: PlannerTiming }) {
  const t = useT()
  const format = useFormat()
  const pass = timing.unloading()
  const byStop = new Map(pass.stops.map((entry) => [entry.stop, entry]))
  return (
    <IndicatorCard title={t('plannerPhysics.unloadTime.title')} tag="estimate" data-unload-time-panel="">
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {stops.map((stop) => {
          const entry = byStop.get(stop.number)
          if (!entry) return null
          return (
            <li key={stop.number} data-unload-time-stop={stop.number} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <StopMark stop={stop.number} decorative />
              <span className="min-w-0 flex-1 text-sky-text">{t('plannerPhysics.unloadTime.stop', { number: stop.number, name: stop.name })}</span>
              <span className="font-mono tabular-nums text-sky-text">{t('plannerPhysics.unloadTime.value', { duration: formatDuration(entry.seconds, t, format) })}</span>
              {entry.moved > 0 ? <span className={cn('w-full pl-7.5', MUTED)}>{t('plannerPhysics.unloadTime.moved', { count: entry.moved })}</span> : null}
            </li>
          )
        })}
      </ul>
      <p className="font-semibold text-sky-text">{t('plannerPhysics.unloadTime.total', { duration: formatDuration(pass.totalSeconds, t, format) })}</p>
      <p className={MUTED}>{t('plannerPhysics.unloadTime.note')}</p>
      <HandlingAssumptions className={MUTED} />
    </IndicatorCard>
  )
}
