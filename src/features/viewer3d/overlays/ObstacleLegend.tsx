import type { VehicleObstacle } from '@/domain/models'
import { useObstacleText } from './useObstacleText'

/**
 * Chú giải vật cản đặt cạnh chú giải điểm giao (LM-033). Chỉ hiện khi xe có vật cản và chỉ liệt kê kiểu vẽ đang có.
 * Màu luôn đi kèm chữ (mục 10).
 */
export function ObstacleLegend({ obstacles }: { obstacles: readonly VehicleObstacle[] }) {
  const { t } = useObstacleText()
  if (obstacles.length === 0) return null
  const rows = [
    obstacles.some((o) => !o.loadBearing && o.type !== 'RESERVED_ZONE')
      ? { key: 'not-bearing', label: t('viewer.obstacles.legendNotBearing'), style: { background: 'var(--obstacle)' } } : null,
    obstacles.some((o) => o.loadBearing && o.type !== 'RESERVED_ZONE')
      ? { key: 'bearing', label: t('viewer.obstacles.legendBearing'), style: { background: 'var(--obstacle-bearing)' } } : null,
    obstacles.some((o) => o.type === 'RESERVED_ZONE')
      ? { key: 'reserved', label: t('viewer.obstacles.legendReserved'),
        style: { background: 'repeating-linear-gradient(135deg, var(--obstacle) 0 3px, transparent 3px 6px)' } } : null,
  ].filter((row) => row !== null)
  return (
    <section aria-label={t('viewer.obstacles.legendTitle')} className="flex min-w-50 flex-col gap-1.5 rounded-lg border border-glass-dark-border bg-canvas-2/45 px-3 py-2.5">
      <span className="text-body-lg font-semibold text-sky-text xl:text-caption">{t('viewer.obstacles.legendTitle')}</span>
      {rows.map((row) => (
        <span key={row.key} className="flex items-center gap-2 text-body-lg xl:text-caption">
          <span aria-hidden className="size-2.5 flex-none rounded-[3px] border border-border-dark" style={row.style} />
          <span className="flex-1">{row.label}</span>
        </span>
      ))}
      <span className="text-body-lg text-glass-dark-muted xl:text-caption">{t('viewer.obstacles.legendHint')}</span>
    </section>
  )
}

/** Mô tả vật cản cho trình đọc màn hình, đặt cạnh Canvas (mục 10): khối 3D không tự có tên. */
export function ObstacleDescriptions({ obstacles }: { obstacles: readonly VehicleObstacle[] }) {
  const text = useObstacleText()
  if (obstacles.length === 0) return null
  return (
    <ul className="sr-only" aria-label={text.t('viewer.obstacles.listLabel')}>
      {obstacles.map((obstacle) => <li key={obstacle.id}>{text.description(obstacle)}</li>)}
    </ul>
  )
}
