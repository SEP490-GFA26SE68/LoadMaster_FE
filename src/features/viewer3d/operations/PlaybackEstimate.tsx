import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/Tooltip'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { TimeScale } from '../viewer-types'
import { MUTED } from '../panels/scene-ui'
import type { PlannerTiming } from './handling-schedule'
import { formatDuration } from './handling-format'
import { HandlingAssumptions } from './HandlingAssumptions'

/**
 * Tổng thời gian thật ước tính của lượt đang xem (xếp hay dỡ cả phương án), đặt ở thanh phát chứ không ở thanh trên — thanh trên đã
 * kín ở 1.366 px. Rê chuột hay focus mở giả định; máy cảm ứng đọc giả định ở hộp Chi tiết (thẻ thời gian dỡ). Từ 1.024 px.
 */
export function PlaybackEstimate({ kind, timing, timeScale }: {
  kind: 'loading' | 'unloading'; timing: PlannerTiming; timeScale: TimeScale
}) {
  const t = useT()
  const format = useFormat()
  const loading = kind === 'loading'
  const duration = formatDuration(loading ? timing.loading().totalSeconds : timing.unloading().totalSeconds, t, format)
  const pass = t(loading ? 'plannerPhysics.estimate.passes.loading' : 'plannerPhysics.estimate.passes.unloading')
  return <TooltipProvider delayDuration={200}>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" data-playback-estimate aria-label={t('plannerPhysics.estimate.trigger', { pass, duration })}
          className="hidden shrink-0 rounded-md px-1.5 py-0.5 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 lg:block">
          <span className={cn('block text-body xl:text-caption', MUTED)}>{t('plannerPhysics.estimate.caption')}</span>
          <span className="block font-display font-semibold tabular-nums whitespace-nowrap text-sky-text">
            {t(loading ? 'plannerPhysics.estimate.loading' : 'plannerPhysics.estimate.unloading', { duration })}
          </span>
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-80"><HandlingAssumptions timeScale={timeScale} /></TooltipContent>
    </Tooltip>
  </TooltipProvider>
}
