import { ArrowRight, ArrowUp, Package, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import type { VehicleConfig } from '@/domain/models'
import type { ScenePlacement, SceneStop, SceneZone } from '@/features/viewer3d/scene-input'
import { useFormat, useT } from '@/lib/i18n'
import { stopColor } from '@/lib/stops'
import { cn } from '@/lib/utils'
import { measureStep, nearestObstacle, stepNote, zonePlace } from './describe-step'
import { OrientationFigure } from './OrientationFigure'
import { StopChip } from './StopChip'

/**
 * Thẻ hướng dẫn xếp một kiện (V2.3 đợt 6, `KhoXepHang.jpg`): mã kiện, điểm giao (chip sáng, số trên màu điểm giao), vùng của kiện trong
 * thùng ("Vùng <điểm giao> — sát cửa", FE-6-05; phương án không chia vùng thì không có dòng này), vị trí và khối lượng cạnh nhau, hướng
 * đặt kèm hình minh hoạ, ghi chú, khoảng cách cm theo locale ba cột và vật cản gần nhất. Chữ tối thiểu 16px trên tablet (mục 10).
 * Lệch có chủ ý: nhãn "Kiện cần xếp" trong design viết hoa — mục 5 cấm.
 */
export function PackageInstructionCard({
  placement,
  placements,
  vehicle,
  stops,
  zones = [],
}: {
  placement: ScenePlacement
  placements: readonly ScenePlacement[]
  vehicle: VehicleConfig
  stops: readonly SceneStop[]
  /** Vùng theo điểm giao của phương án (`ViewerSceneModel.zones`). */
  zones?: readonly SceneZone[]
}) {
  const t = useT()
  const format = useFormat()
  const stopName = stops.find((s) => s.number === placement.stop)?.name ?? ''
  const zone = zonePlace(zones, placement.zoneId)
  const note = stepNote(placement, placements)
  const measured = measureStep(placement, placements, vehicle)
  const obstacle = nearestObstacle(placement, vehicle.obstacles)
  const distances = [
    [t('warehouse.distances.front'), measured.frontCm],
    [t('warehouse.distances.left'), measured.leftCm],
    [t('warehouse.distances.right'), measured.rightCm],
    [t('warehouse.distances.rear'), measured.rearCm],
    [t('warehouse.distances.floor'), measured.floorCm],
  ] as const

  return (
    <Card className="flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-body-lg font-medium text-ink-3">{t('warehouse.card.title')}</span>
          <h1 className="font-mono text-[32px] leading-10 font-semibold tracking-[-0.02em] text-ink-strong">{placement.id}</h1>
          <span className="text-body-lg text-ink-2">{placement.name}</span>
          {zone ? (
            <span data-part="zone" className="text-body-lg font-medium text-ink-strong">
              {t('warehouse.card.zone', { name: zone.name, place: t(`warehouse.card.zonePlace.${zone.place}`) })}
            </span>
          ) : null}
        </div>
        <StopChip stop={placement.stop} label={t('warehouse.card.stop', { number: placement.stop, name: stopName })} className="max-w-full" />
      </div>

      <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-3">
        <Tile label={t('warehouse.tiles.position')}>
          {t('warehouse.layer', { layer: format.integer(measured.layer), rear: format.length(measured.rearCm) })}
        </Tile>
        <Tile label={t('warehouse.tiles.weight')}>
          <span className="font-mono">{format.weight(placement.weightKg)}</span>
        </Tile>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-line-soft bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <span className="text-body-lg text-ink-3">{t('warehouse.tiles.orientation')}</span>
          <span className="text-h3 leading-6 font-semibold text-pretty text-ink-strong">
            <span className="font-mono">{placement.orientation}</span> · {t(`warehouse.orientations.${placement.orientation}`)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <OrientationFigure placement={placement} />
          <ul className="m-0 flex min-w-0 list-none flex-col gap-2 p-0 text-body-lg text-ink-2">
            <li className="flex items-center gap-2.5">
              <span aria-hidden className="size-3 flex-none rounded-[3px]" style={{ background: stopColor(placement.stop) }} />
              <span className="font-mono">{format.dimensions(placement.lengthCm, placement.widthCm, placement.heightCm)}</span>
            </li>
            <li className="flex items-center gap-2.5">
              <ArrowRight className="size-4 flex-none" strokeWidth={2} aria-hidden />
              {t('warehouse.figure.doorArrow')}
            </li>
            <li className="flex items-center gap-2.5">
              <ArrowUp className="size-4 flex-none text-primary" strokeWidth={2} aria-hidden />
              {t('warehouse.figure.topArrow')}
            </li>
          </ul>
        </div>
      </div>

      <div
        role="note"
        className={cn(
          'flex items-center gap-3 rounded-lg border px-4 py-3',
          note.tone === 'warning'
            ? 'border-badge-warning-border bg-badge-warning-bg text-badge-warning-fg'
            : 'border-line-soft bg-surface text-ink-2',
        )}
      >
        {note.tone === 'warning' ? (
          <TriangleAlert className="size-6 flex-none" strokeWidth={2} aria-hidden />
        ) : (
          <Package className="size-6 flex-none" strokeWidth={2} aria-hidden />
        )}
        <span className="text-[18px] leading-6 font-semibold">{t(`warehouse.notes.${note.code}`)}</span>
      </div>

      <dl className="m-0 grid grid-cols-3 gap-x-4 gap-y-3 rounded-lg border border-line-soft p-4 text-body-lg">
        {distances.map(([label, value]) => (
          <div key={label}><dt className="text-ink-3">{label}</dt><dd className="m-0 font-mono font-medium text-ink-strong">{format.length(value)}</dd></div>
        ))}
        <div><dt className="text-ink-3">{t('warehouse.distances.below')}</dt><dd className="m-0 font-mono font-medium text-ink-strong">{measured.belowId ?? t('warehouse.distances.noneBelow')}</dd></div>
        {obstacle ? (
          <div className="col-span-3 flex flex-wrap items-baseline justify-between gap-x-3 border-t border-line-soft pt-3">
            <dt className="text-ink-3">{t('warehouse.distances.obstacle')}</dt>
            <dd className="m-0 font-medium text-ink-strong">{t('warehouse.distances.obstacleValue', {
              type: t(`viewer.obstacles.types.${obstacle.obstacle.type}`),
              id: obstacle.obstacle.id,
              gap: format.length(obstacle.gapCm),
            })}</dd>
          </div>
        ) : null}
      </dl>
    </Card>
  )
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface p-4">
      <span className="text-body-lg text-ink-3">{label}</span>
      <span className="font-display text-h2 leading-6 font-bold text-pretty text-ink-strong">{children}</span>
    </div>
  )
}
