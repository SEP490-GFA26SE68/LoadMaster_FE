import { CheckCircle2, Pin } from 'lucide-react'
import { useId, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import type { ConstraintIssue } from '@/domain/constraints'
import type { VehicleConfig } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ScenePlacement, SceneStop, SceneUnplaced } from '@/features/viewer3d/scene-input'
import { describeWhere } from './placement-relations'
import { PlacedPackageList } from './PlacedPackageList'
import { DARK_FIELD, DARK_SUBCARD, GLASS_PRESSED, MUTED, StopMark } from './scene-ui'

/**
 * Tab "Danh sách" của hộp thông tin (V2.3 Planner3DThongTin): ba khối xếp chồng — chưa xếp (lọc theo lý do), đã ghim, đã xếp
 * (LM-049: tìm, lọc điểm giao, chỉ kiện có cảnh báo). Lệch có chủ ý: bản design gốc gợi ý "kéo vào vùng 3D để xếp thủ công" —
 * thao tác đó chưa được nối nên không hiện cursor kéo lẫn câu gợi ý.
 */
export function PackageListPanel({ unplaced, pinned, placements, vehicle, selectedId, onSelect, stops, issues, tripId }: {
  unplaced: readonly SceneUnplaced[]
  pinned: readonly ScenePlacement[]
  placements: readonly ScenePlacement[]
  vehicle: VehicleConfig
  selectedId: string | null
  onSelect: (id: string) => void
  stops: readonly SceneStop[]
  issues: readonly ConstraintIssue[]
  /** Mở kiện gốc trong Chi tiết chuyến (`?kien=`, LM-046) */
  tripId: string
}) {
  const t = useT()
  const format = useFormat()
  const [reason, setReason] = useState('')
  const reasons = useMemo(() => [...new Set(unplaced.flatMap((item) => item.reasonCode ? [item.reasonCode] : []))], [unplaced])
  const shownUnplaced = reason === '' ? unplaced : unplaced.filter((item) => item.reasonCode === reason)
  const total = placements.length + unplaced.length
  return (
    <section aria-label={t('viewer.packageList.label')} className="flex min-h-full flex-col gap-2 p-3 text-body-lg xl:text-body">
      <Section title={t('viewer.packageList.unplacedTab')} count={unplaced.length} tone={unplaced.length ? 'warn' : 'plain'}
        action={reasons.length > 1 ? (
          <select aria-label={t('viewer.plan.filters.reason')} value={reason} onChange={(event) => setReason(event.target.value)} className={cn(DARK_FIELD, 'xl:h-7.5')}>
            <option value="">{t('viewer.plan.filters.allReasons')}</option>
            {reasons.map((code) => <option key={code} value={code}>{t(`viewer.unplacedReasons.${code}`)}</option>)}
          </select>
        ) : null}>
        {unplaced.length === 0 ? (
          <p className={cn('mt-1 flex items-start gap-2 xl:text-fine', MUTED)}>
            <CheckCircle2 className="mt-0.5 size-4 flex-none text-green-500" strokeWidth={1.5} aria-hidden />
            {t('viewer.packageList.allPlaced', { placed: format.integer(placements.length), total: format.integer(total) })}
          </p>
        ) : <>
          <p className={cn('mt-1 xl:text-caption', MUTED)}>{t('viewer.packageList.unplacedHint')}</p>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
            {shownUnplaced.map((item) => (
              <li key={item.id} className="flex gap-2.5 rounded-md border border-dashed border-amber-500/45 p-2.5">
                <StopMark stop={item.stop} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Link to={`/chuyen/${tripId}?kien=${encodeURIComponent(item.packageId)}`} className="font-mono font-medium text-cyan-200">{item.id}</Link>
                  <span className={cn('font-mono text-caption', MUTED)}>
                    {format.dimensions(item.lengthCm, item.widthCm, item.heightCm)} · {format.weight(item.weightKg)}
                  </span>
                  <span className="text-caption text-amber-200">{t(`viewer.unplacedReasons.${item.reasonCode ?? 'UNKNOWN'}`)}</span>
                  {/* `message` của service thật có thể khác mã lý do; mock ghi lại đúng mã nên không lặp */}
                  {item.message && item.message !== item.reasonCode ? <span className={cn('text-caption', MUTED)}>{item.message}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </>}
      </Section>

      <Section title={t('viewer.packageList.pinnedTab')} count={pinned.length} hint={t('viewer.packageList.pinnedHint')}
        inline={pinned.length === 0 ? t('viewer.packageList.noPinned') : undefined}>
        {pinned.length ? <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0">
          {pinned.map((item) => (
            <li key={item.id}>
              <button type="button" onClick={() => onSelect(item.id)} aria-pressed={item.id === selectedId}
                className={cn('flex w-full gap-2.5 rounded-md border border-glass-dark-border bg-sky-glass/60 p-2.5 text-left hover:bg-sky-glass-hover',
                  'focus-visible:outline-2 focus-visible:outline-primary', GLASS_PRESSED)}>
                <StopMark stop={item.stop} />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex items-center gap-1.5 font-mono font-medium text-sky-text">
                    {item.id}<Pin className="size-3.5 text-amber-500" strokeWidth={1.5} aria-label={t('viewer.packageList.pinned')} />
                  </span>
                  <span className={cn('font-mono text-caption', MUTED)}>{format.dimensions(item.lengthCm, item.widthCm, item.heightCm)} · {format.weight(item.weightKg)}</span>
                  <span className={cn('text-caption', MUTED)}><PinnedWhere where={describeWhere(item, placements, vehicle)} /></span>
                </span>
              </button>
            </li>
          ))}
        </ul> : null}
      </Section>

      <div className={cn('flex min-h-96 flex-1 flex-col', DARK_SUBCARD)}>
        <SectionHeader title={t('viewer.plan.filters.placedTab')} count={placements.length} note={t('viewer.packageList.byLoadingOrder')} className="px-3 pt-2.5" />
        <PlacedPackageList placements={placements} stops={stops} issues={issues} selectedId={selectedId} onSelect={onSelect} />
      </div>
    </section>
  )
}

function Section({ title, count, tone = 'plain', action, inline, hint, children }: {
  title: string; count: number; tone?: 'plain' | 'warn'; action?: ReactNode; inline?: string; hint?: string; children?: ReactNode
}) {
  const titleId = useId()
  // Vùng có tên (tiêu đề khối): "Kiện chưa xếp", "Kiện đã ghim" đọc được như một mục riêng, thay các tab con cũ
  return (
    <section aria-labelledby={titleId} className={cn('px-3 py-2.5', DARK_SUBCARD, tone === 'warn' && 'border-amber-500/35')} title={hint}>
      <SectionHeader titleId={titleId} title={title} count={count} inline={inline} action={action} />
      {children}
    </section>
  )
}

function SectionHeader({ titleId, title, count, inline, note, action, className }: {
  titleId?: string; title: string; count: number; inline?: string; note?: string; action?: ReactNode; className?: string
}) {
  const format = useFormat()
  return (
    <div className={cn('flex min-h-7.5 flex-wrap items-center gap-2', className)}>
      <h3 id={titleId} className="font-semibold text-sky-text xl:text-lede">{title}</h3>
      <span className="rounded-sm bg-sky-glass-hover px-1.5 py-0.5 font-display text-caption font-semibold tabular-nums">{format.integer(count)}</span>
      {inline ? <span className={cn('xl:text-fine', MUTED)}>· {inline}</span> : null}
      {note ? <span className={cn('ml-auto text-caption', MUTED)}>{note}</span> : null}
      {action ? <span className="ml-auto">{action}</span> : null}
    </div>
  )
}

function PinnedWhere({ where }: { where: ReturnType<typeof describeWhere> }) {
  const t = useT()
  const layer = where.layer === 1 ? t('viewer.packageList.floor') : t('viewer.packageList.layer', { layer: where.layer })
  return <>{t('viewer.packageList.where', { layer, side: t(`viewer.packageList.sides.${where.side}`) })}</>
}
