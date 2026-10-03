import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/Badge'
import type { DeadlineStatus } from '@/domain/routing'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { GlassChip, MUTED, StopMark, type GlassChipTone } from '../panels/scene-ui'
import type { ScenePlacement, SceneStop, SceneZone } from '../scene-input'

/** Mức hạn: kịp hạn xanh lá, sát hạn hổ phách, trễ hạn dự kiến đỏ — luôn kèm chữ (như chi tiết chuyến, FE-4b-09). */
const DEADLINE_TONE: Readonly<Record<DeadlineStatus, GlassChipTone>> = { OK: 'ok', AT_RISK: 'warn', MISSED: 'bad' }

function Card({ title, mock, children }: { title: string; mock: boolean; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex w-full min-w-64 flex-col gap-2 rounded-lg border border-glass-dark-border bg-canvas-2/45 p-3 text-body-lg xl:text-caption">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-sky-text">{title}</h3>
        {mock ? <Badge shape="tag" tone="mock" className="border-amber-500/45 text-amber-500">MOCK RESULT</Badge> : null}
      </div>
      {children}
    </section>
  )
}

/**
 * Số lần dỡ-xếp lại ở hộp Chi tiết (FE-5b-07, D-79): số kiện nằm ngoài vùng của điểm giao mình trong **bản đang xem, kể cả đang chỉnh
 * tay** — cùng luật với `rehandlingCount` của kết quả. Vùng là của mock nên số mang MOCK RESULT. Phương án không chia vùng thì chỉ có
 * một câu nói vì sao chưa tính, không có số.
 */
export function RehandlingPanel({ zones, placements, isMockResult }: {
  zones: readonly SceneZone[]
  placements: readonly ScenePlacement[]
  isMockResult: boolean
}) {
  const t = useT()
  const count = placements.reduce((sum, placement) => sum + (placement.outOfZone ? 1 : 0), 0)
  if (zones.length === 0) {
    return <Card title={t('viewer.rehandling.title')} mock={false}><p className={MUTED}>{t('viewer.rehandling.noZones')}</p></Card>
  }
  return (
    <Card title={t('viewer.rehandling.title')} mock={isMockResult}>
      <p data-rehandling-count={count} className={cn('font-semibold', count > 0 ? 'text-amber-200' : 'text-sky-text')}>
        {count > 0 ? t('viewer.rehandling.count', { count }) : t('viewer.rehandling.none')}
      </p>
      <p className={MUTED}>{t('viewer.rehandling.hint')}</p>
    </Card>
  )
}

/**
 * Mức hạn của từng điểm giao ở hộp Chi tiết (FE-5b-07): giờ đến dự kiến và mức hạn theo tuyến đã tối ưu của chuyến (kết quả của mock
 * tối ưu tuyến). Điểm không có hạn ghi rõ là không có hạn; chuyến chưa tối ưu tuyến thì chỉ có một câu, không có giờ nào.
 */
export function DeadlinePanel({ stops }: { stops: readonly SceneStop[] }) {
  const t = useT()
  const format = useFormat()
  const routed = stops.some((stop) => stop.eta !== undefined)
  return (
    <Card title={t('viewer.deadlines.title')} mock={routed}>
      {routed ? (
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {stops.map((stop) => (
            <li key={stop.number} className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <StopMark stop={stop.number} decorative />
              <span className="min-w-0 flex-1 text-sky-text">{t('viewer.deadlines.stop', { number: stop.number, name: stop.name })}</span>
              {stop.deadlineStatus
                ? <GlassChip tone={DEADLINE_TONE[stop.deadlineStatus]} size="tag">{t(`common.deadlineStatuses.${stop.deadlineStatus}`)}</GlassChip>
                : <span className={MUTED}>{t('viewer.deadlines.noDeadline')}</span>}
              {stop.eta ? <span className={cn('w-full pl-7.5 tabular-nums', MUTED)}>{t('viewer.deadlines.eta', { time: format.time(stop.eta), date: format.date(stop.eta) })}</span> : null}
            </li>
          ))}
        </ul>
      ) : <p className={MUTED}>{t('viewer.deadlines.noRoute')}</p>}
    </Card>
  )
}
