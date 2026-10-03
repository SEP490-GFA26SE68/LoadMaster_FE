import { ArrowRight, ArrowUp, Package, TriangleAlert } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import type { VehicleConfig } from '@/domain/models'
import type { ScenePlacement, SceneStop, SceneZone } from '@/features/viewer3d/scene-input'
import { useFormat, useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { cn } from '@/lib/utils'
import { measureStep, nearestObstacle, stepNote, zonePlace } from './describe-step'
import { OrientationFigure } from './OrientationFigure'

/**
 * Thẻ hướng dẫn xếp một kiện: mã kiện cỡ lớn, điểm giao, vùng của kiện trong thùng ("Vùng <điểm giao> — sát cửa", FE-6-05; phương án
 * không chia vùng thì không có dòng này), ba ô thông tin, khoảng cách cm theo locale, vật cản gần nhất, ghi chú và hình minh hoạ hướng đặt. Chữ tối thiểu 16px trên tablet (mục 10).
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
    <Card className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-body-lg font-medium text-text-3">{t('warehouse.card.title')}</span>
          <h1 className="font-mono text-[40px] leading-12 font-semibold tracking-[-0.02em]">{placement.id}</h1>
          <span className="text-body-lg text-text-2">{placement.name}</span>
          {zone ? (
            <span data-part="zone" className="text-body-lg font-medium text-text">
              {t('warehouse.card.zone', { name: zone.name, place: t(`warehouse.card.zonePlace.${zone.place}`) })}
            </span>
          ) : null}
        </div>
        <span
          className="inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-body-lg font-semibold"
          style={{ background: stopColor(placement.stop), color: stopForeground(placement.stop) }}
        >
          {t('warehouse.card.stop', { number: placement.stop, name: stopName })}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <Tile label={t('warehouse.tiles.position')}>
          {t('warehouse.layer', { layer: format.integer(measured.layer), rear: format.length(measured.rearCm) })}
        </Tile>
        <Tile label={t('warehouse.tiles.orientation')}>
          <span className="font-mono">{placement.orientation}</span> · {t(`warehouse.orientations.${placement.orientation}`)}
        </Tile>
        <Tile label={t('warehouse.tiles.weight')}>
          <span className="font-mono text-[28px] leading-8 tracking-[-0.01em]">{format.weight(placement.weightKg)}</span>
        </Tile>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-body-lg">
        {distances.map(([label, value]) => (
          <div key={label}><dt className="text-text-2">{label}</dt><dd className="font-mono">{format.length(value)}</dd></div>
        ))}
        <div><dt className="text-text-2">{t('warehouse.distances.below')}</dt><dd className="font-mono">{measured.belowId ?? t('warehouse.distances.noneBelow')}</dd></div>
        {obstacle ? (
          <div className="col-span-2">
            <dt className="text-text-2">{t('warehouse.distances.obstacle')}</dt>
            <dd>{t('warehouse.distances.obstacleValue', {
              type: t(`viewer.obstacles.types.${obstacle.obstacle.type}`),
              id: obstacle.obstacle.id,
              gap: format.length(obstacle.gapCm),
            })}</dd>
          </div>
        ) : null}
      </dl>

      <div
        role="note"
        className={cn(
          'flex items-center gap-3 rounded-md border px-4 py-3.5',
          note.tone === 'warning'
            ? 'border-badge-warning-border bg-badge-warning-bg text-badge-warning-fg'
            : 'border-border bg-surface text-text-2',
        )}
      >
        {note.tone === 'warning' ? (
          <TriangleAlert className="size-6 flex-none" strokeWidth={2} aria-hidden />
        ) : (
          <Package className="size-6 flex-none" strokeWidth={2} aria-hidden />
        )}
        <span className="text-[18px] leading-6 font-semibold">{t(`warehouse.notes.${note.code}`)}</span>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <OrientationFigure placement={placement} />
        <ul className="flex min-w-0 flex-col gap-2 text-body-lg text-text-2">
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
    </Card>
  )
}

function Tile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border bg-surface p-4">
      <span className="text-body-lg text-text-3">{label}</span>
      <span className="text-h2 leading-[26px] font-semibold text-pretty">{children}</span>
    </div>
  )
}
