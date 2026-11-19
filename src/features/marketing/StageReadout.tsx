import { useId } from 'react'
import { StopDot } from '@/components/StopChip'
import { Badge } from '@/components/ui/Badge'
import { UNLOAD_STOP } from '@/features/viewer3d/landing/story-timeline'
import { useFormat, useT, type MessageKey } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LandingPlan } from './landing-plans'
import { STAGE_SURFACE } from './LandingStageParts'
import { Reveal } from './reveal'

type ReadoutCell = { key: string; label: MessageKey; value: string }
const CELL_LABELS = ['placed', 'volume', 'payload', 'rehandling', 'runtime'] as const
const STOP_LABELS = ['count', 'moved', 'foreign', 'stray'] as const

/**
 * Các ô cùng bố cục cho bản chờ (nhãn kèm vạch giữ chỗ) và bản có số: dải không đổi chiều cao khi số hiện ra. Điện thoại: ba cột (hàng
 * điểm 1 hai cột), số 16 px.
 */
const CELLS = 'm-0 grid grid-cols-3 gap-x-3 gap-y-3 sm:gap-x-4 md:grid-cols-5'
const STOP_CELLS = 'm-0 grid grid-cols-2 gap-x-3 gap-y-3 sm:gap-x-4 md:grid-cols-4'
const CELL = 'flex min-w-0 flex-col justify-end gap-0.5'
const LABEL = 'text-small text-sky-text-3 pointer-coarse:text-body-lg'
const VALUE = 'm-0 font-mono text-body-lg leading-6 font-semibold whitespace-nowrap text-sky-text tabular-nums sm:text-h2 sm:leading-7'
const SUBTITLE = 'm-0 flex min-h-6 items-center gap-2 text-small font-semibold text-sky-text-2 pointer-coarse:text-body-lg'
/** Vạch giữ chỗ của một số: đúng chiều cao dòng số, độ dài khác nhau theo ô. */
const BAR = 'block h-6 max-w-full rounded-sm bg-sky-glass sm:h-7'
const BAR_WIDTHS = ['w-20', 'w-14', 'w-14', 'w-8', 'w-16'] as const

function Cells({ cells, className, shown }: { cells: readonly ReadoutCell[]; className: string; shown: boolean }) {
  const t = useT()
  if (!shown) return (
    <div aria-hidden className={className}>
      {cells.map((cell, index) => (
        <div key={cell.key} className={CELL}>
          <span className={LABEL}>{t(cell.label)}</span>
          <span className={cn(BAR, BAR_WIDTHS[index % BAR_WIDTHS.length])} />
        </div>
      ))}
    </div>
  )
  return (
    <dl className={className}>
      {cells.map((cell, index) => (
        <Reveal key={cell.key} kind="pop" index={index} className={CELL}>
          <dt className={LABEL}>{t(cell.label)}</dt>
          <dd className={VALUE}>{cell.value}</dd>
        </Reveal>
      ))}
    </dl>
  )
}

/**
 * Dải số của phương án đang xem, dưới khung. Trước khi xếp xong: nhãn kèm vạch giữ chỗ và câu chờ (từ 768 px nằm cạnh tiêu đề; hẹp hơn
 * chỉ cho trình đọc màn hình — vạch đã nói số chưa có), cùng chiều cao với bản có số. Xếp xong: tên phương án và năm ô — kiện đã xếp / kiện
 * của yêu cầu, lấp đầy, tải trọng, kiện phải dỡ-xếp lại, thời gian tính —, rồi hàng của điểm 1: số kiện của điểm, số kiện giao sau phải
 * dời mới lấy được, và hai số nằm sai vùng (`FirstStopFacts`; phương án không chia vùng thì không có hai ô này). Ô bật ra lần lượt cách
 * nhau 70 ms; số không đếm, không lăn. Không MOCK RESULT: trang công khai nói nguồn bằng câu dưới khung.
 */
export function StageReadout({ plan, total, stopName, className }: { plan: LandingPlan | null; total: number; stopName: string; className?: string }) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const result = plan?.result
  const metrics = result?.metrics
  const cells: ReadoutCell[] = !result || !metrics ? CELL_LABELS.map((key) => ({ key, label: `landing.stage.readout.${key}`, value: ' ' })) : [
    { key: 'placed', label: 'landing.stage.readout.placed', value: t('landing.stage.readout.placedValue', { placed: format.integer(result.placements.length), total: format.integer(total) }) },
    { key: 'volume', label: 'landing.stage.readout.volume', value: format.percent(metrics.volumeUtilizationPercent) },
    { key: 'payload', label: 'landing.stage.readout.payload', value: format.percent(metrics.payloadUtilizationPercent) },
    ...(metrics.rehandlingCount === undefined ? [] : [{ key: 'rehandling', label: 'landing.stage.readout.rehandling', value: format.integer(metrics.rehandlingCount) } as const]),
    { key: 'runtime', label: 'landing.stage.readout.runtime', value: t('landing.stage.readout.runtimeValue', { ms: format.integer(Math.max(1, Math.round(metrics.runtimeMs))) }) },
  ]
  const facts = plan?.firstStop
  const zone = facts?.outOfZone
  const stopCells: ReadoutCell[] = !facts ? STOP_LABELS.map((key) => ({ key, label: `landingStage.stop.${key}`, value: ' ' })) : [
    { key: 'count', label: 'landingStage.stop.count', value: format.integer(facts.count) },
    { key: 'moved', label: 'landingStage.stop.moved', value: format.integer(facts.moved) },
    ...(zone ? [
      { key: 'foreign', label: 'landingStage.stop.foreign', value: format.integer(zone.foreign) } as const,
      { key: 'stray', label: 'landingStage.stop.stray', value: format.integer(zone.stray) } as const,
    ] : []),
  ]
  // Cổng hiện ra là cả dải (lộ 15 % là đủ, kể cả khi dải nằm sát mép dưới cửa sổ): ô số gắn vào lúc xếp xong thì bật ra ngay nếu dải
  // đang trong khung nhìn, còn không thì chờ tới khi cuộn tới
  return (
    <Reveal group role="group" aria-labelledby={titleId} data-stage-readout="" className={cn(STAGE_SURFACE, 'flex flex-col gap-2.5 rounded-lg px-4 py-3', className)}>
      <div className="flex min-h-5 flex-wrap items-center gap-2 pointer-coarse:min-h-7">
        <p id={titleId} className="m-0 text-small font-semibold text-sky-text-2 pointer-coarse:text-body-lg">{t('landing.stage.readout.title')}</p>
        {plan ? (
          <Badge shape="tag" className="pointer-coarse:text-body-lg">
            {t('landingStage.plans.name', { label: plan.id, objective: t(`runs.objectives.${plan.objective}`) })}
          </Badge>
        ) : <p className="m-0 text-small text-sky-text-3 max-md:sr-only pointer-coarse:text-body-lg">{t('landing.stage.readout.pending')}</p>}
      </div>
      <Cells cells={cells} className={CELLS} shown={plan !== null} />
      <div className="flex flex-col gap-2 border-t border-border-dark pt-2.5" data-stage-stop="">
        <p className={SUBTITLE}>
          <StopDot stop={UNLOAD_STOP} className="size-6 text-small pointer-coarse:size-7 pointer-coarse:text-body-lg" />
          {t('landingStage.stop.title', { number: format.integer(UNLOAD_STOP), name: stopName })}
        </p>
        <Cells cells={stopCells} className={STOP_CELLS} shown={plan !== null} />
      </div>
    </Reveal>
  )
}
