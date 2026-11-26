import { useCallback } from 'react'
import { useT } from '@/lib/i18n'
import type { OperationsState } from './operations/useOperations'
import { PlaybackEstimate } from './operations/PlaybackEstimate'
import { Timeline } from './Timeline'
import type { LoadPlanViewerState } from './useLoadPlanViewer'
import { TIME_SCALES, type TimeScale } from './viewer-types'

/**
 * Thanh phát của Planner, chung cho phương án kho mẫu và máy chủ: phát theo thời gian thật ước tính × hệ số (×1 · ×2 · ×5 · ×10, mặc
 * định ×10 — Spec vật lý 10.3) kèm tổng thời gian thật của lượt đang xem.
 */
export function PlannerTimeline({ state, operations }: { state: LoadPlanViewerState; operations: OperationsState }) {
  const t = useT()
  const unloading = operations.kind === 'unloading'
  const scaleText = useCallback((scale: TimeScale) => t('plannerPhysics.speed.option', { scale }), [t])
  return <Timeline<TimeScale>
    placements={state.placements}
    kind={operations.kind}
    orderedOverride={unloading ? operations.unload.ordered : undefined}
    suggested={!operations.unload.fromResult}
    step={unloading ? operations.unload.cursor : state.step}
    totalSteps={unloading ? operations.unload.ordered.length : state.totalSteps}
    playing={operations.playing}
    speed={state.timeScale}
    speeds={TIME_SCALES}
    speedLabel={t('plannerPhysics.speed.label')}
    speedText={scaleText}
    onSpeedChange={state.setTimeScale}
    onStepChange={unloading ? operations.unload.setCursor : state.setStep}
    onStepForward={operations.stepForward}
    onStepBackward={operations.stepBackward}
    onGoToStart={operations.goToStart}
    onTogglePlaying={operations.togglePlaying}
    extra={<PlaybackEstimate kind={operations.kind} timing={state.timing} timeScale={state.timeScale} />}
  />
}
