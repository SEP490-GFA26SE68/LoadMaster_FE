import { AlertCircle, MapPinOff, Pin } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ConstraintIssue } from '@/domain/constraints'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { ScenePlacement, SceneStop } from '../scene-input'
import { DARK_FIELD, GLASS_PRESSED, GlassChip, MUTED, StopMark } from './scene-ui'

/** Giữ danh sách nhẹ ở 1.000 kiện: lọc trước, hiện tối đa bấy nhiêu dòng. */
const MAX_ROWS = 100

/** Kiện dính tới issue: chủ thể hoặc nằm trong `relatedIds`. */
export function issueIdsOf(issues: readonly ConstraintIssue[]): Set<string> {
  const ids = new Set<string>()
  for (const issue of issues) {
    if (issue.packageInstanceId) ids.add(issue.packageInstanceId)
    for (const id of issue.relatedIds ?? []) ids.add(id)
  }
  return ids
}

/**
 * Danh sách kiện đã xếp (LM-049) theo thứ tự xếp: lọc theo điểm giao, chỉ kiện có cảnh báo, tìm theo mã; bấm để xem chi tiết.
 * Kiện có cảnh báo gắn nhãn hổ phách: tỷ lệ đỡ đáy (%) khi kiện không được đỡ trọn, còn lại chữ "Cảnh báo". Kiện đã ghim (FE-BL-02) gắn nhãn "Đã ghim" kèm biểu tượng ghim. Kiện nằm ngoài vùng của
 * điểm giao mình (FE-5b-07) gắn nhãn "Ngoài vùng"; khi phương án có kiện như vậy thì có thêm ô lọc riêng.
 */
export function PlacedPackageList({ placements, stops, issues, selectedId, onSelect }: {
  placements: readonly ScenePlacement[]
  stops: readonly SceneStop[]
  issues: readonly ConstraintIssue[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  const t = useT()
  const format = useFormat()
  const [query, setQuery] = useState('')
  const [stop, setStop] = useState<number | null>(null)
  const [onlyWarnings, setOnlyWarnings] = useState(false)
  const [onlyOutOfZone, setOnlyOutOfZone] = useState(false)
  const anyOutOfZone = useMemo(() => placements.some((p) => p.outOfZone), [placements])
  const flagged = useMemo(() => issueIdsOf(issues), [issues])
  const ordered = useMemo(() => placements.toSorted((a, b) => a.step - b.step), [placements])
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return ordered.filter((p) => (stop === null || p.stop === stop)
      && (!onlyWarnings || flagged.has(p.id))
      && (!(onlyOutOfZone && anyOutOfZone) || p.outOfZone)
      && (needle === '' || p.id.toLowerCase().includes(needle)))
  }, [ordered, stop, onlyWarnings, onlyOutOfZone, anyOutOfZone, flagged, query])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
      <div className="flex flex-wrap gap-2">
        <input type="search" aria-label={t('viewer.plan.filters.search')} placeholder={t('viewer.plan.filters.search')}
          value={query} onChange={(event) => setQuery(event.target.value)} className={cn(DARK_FIELD, 'min-w-40 flex-1 font-mono')} />
        <select aria-label={t('viewer.plan.filters.allStops')} value={stop ?? ''} className={cn(DARK_FIELD, 'flex-1 xl:max-w-40')}
          onChange={(event) => setStop(event.target.value === '' ? null : Number(event.target.value))}>
          <option value="">{t('viewer.plan.filters.allStops')}</option>
          {stops.map((item) => <option key={item.number} value={item.number}>{item.number} · {item.name}</option>)}
        </select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <label className="flex min-h-14 items-center gap-2 text-body-lg xl:min-h-0 xl:text-small">
          <input type="checkbox" checked={onlyWarnings} onChange={(event) => setOnlyWarnings(event.target.checked)} className="size-4 accent-cyan-400" />
          {t('viewer.plan.filters.onlyWarnings')}
        </label>
        {anyOutOfZone ? (
          <label className="flex min-h-14 items-center gap-2 text-body-lg xl:min-h-0 xl:text-small">
            <input type="checkbox" checked={onlyOutOfZone} onChange={(event) => setOnlyOutOfZone(event.target.checked)} className="size-4 accent-cyan-400" />
            {t('viewer.zones.onlyOutOfZone')}
          </label>
        ) : null}
        <p className={cn('text-caption', MUTED)}>
          {t('viewer.plan.filters.shown', { shown: format.integer(Math.min(filtered.length, MAX_ROWS)), total: format.integer(filtered.length) })}
        </p>
      </div>
      <ul className="m-0 flex min-h-0 flex-1 list-none flex-col gap-0.75 overflow-y-auto p-0">
        {filtered.slice(0, MAX_ROWS).map((p) => {
          const warn = flagged.has(p.id)
          return (
            <li key={p.id}>
              <button type="button" onClick={() => onSelect(p.id)} aria-pressed={p.id === selectedId}
                className={cn('flex min-h-14 w-full items-center gap-2 rounded-md border px-2 text-left xl:min-h-9',
                  'focus-visible:outline-2 focus-visible:outline-primary', GLASS_PRESSED,
                  warn || p.outOfZone ? 'border-amber-500/35 bg-amber-500/7' : 'border-glass-dark-border bg-sky-glass/60 hover:bg-sky-glass-hover')}>
                <StopMark stop={p.stop} decorative />
                <span className="w-24 flex-none font-mono text-sky-text xl:text-fine">{p.id}</span>
                <span className={cn('min-w-0 flex-1 font-mono text-caption', MUTED)}>
                  {format.dimensions(p.lengthCm, p.widthCm, p.heightCm)} · {format.weight(p.weightKg)}
                </span>
                {p.pinned ? <GlassChip tone="cyan" size="tag"><Pin strokeWidth={1.5} aria-hidden />{t('viewer.pins.tag')}</GlassChip> : null}
                {p.outOfZone ? <GlassChip tone="warn" size="tag"><MapPinOff strokeWidth={1.5} aria-hidden />{t('viewer.zones.outOfZone')}</GlassChip> : null}
                {warn ? <GlassChip tone="warn" size="tag">
                  <AlertCircle strokeWidth={1.5} aria-hidden />
                  {p.supportRatio < 1 ? t('viewer.packageList.support', { value: format.percent(p.supportRatio * 100) }) : t('viewer.packageList.warning')}
                </GlassChip> : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
