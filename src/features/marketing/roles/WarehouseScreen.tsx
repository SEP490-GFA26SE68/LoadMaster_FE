import { useFormat, useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { DeviceFrame } from './DeviceFrame'
import { zonePlaceOf, type RoleCargo } from './roles-model'
import { MiniCard, MiniMeter, MiniPrimary, MiniStop, Screen, ScreenBar } from './screen-parts'

/** Thùng xe nhìn từ trên trong hộp 100 × 40: đầu xe bên trái, cửa sau bên phải. */
const BED = { left: 5, right: 95, top: 6, bottom: 30 } as const

/**
 * Thùng nhìn từ trên với các vùng theo điểm giao (`stopZones` của domain): vùng đã xếp tô đặc màu điểm giao, vùng đang xếp viền màu
 * kèm kiện đang xếp tô `--highlight` (như kiện "Hiện tại" trên khung 3D của kho), vùng chưa xếp chỉ có viền nét đứt.
 */
function BedSketch({ cargo, frontLabel, doorLabel }: { cargo: RoleCargo; frontLabel: string; doorLabel: string }) {
  const width = BED.right - BED.left
  const current = cargo.loadingLine.stop
  return (
    <svg viewBox="0 0 100 40" className="block h-auto w-full">
      <rect x={BED.left} y={BED.top} width={width} height={BED.bottom - BED.top} rx={1.2} className="fill-canvas-2 stroke-border-dark" strokeWidth={0.5} />
      {cargo.zones.map((zone) => {
        const x = BED.left + zone.start * width
        const w = (zone.end - zone.start) * width
        const loaded = zone.stop > current
        const mid = x + w / 2
        return (
          <g key={zone.stop}>
            <rect
              x={x + 0.4}
              y={BED.top + 0.8}
              width={Math.max(w - 0.8, 0)}
              height={BED.bottom - BED.top - 1.6}
              rx={0.8}
              fill={loaded ? stopColor(zone.stop) : 'none'}
              fillOpacity={loaded ? 0.85 : undefined}
              stroke={stopColor(zone.stop)}
              strokeWidth={0.5}
              strokeDasharray={loaded || zone.stop === current ? undefined : '1.4 1'}
            />
            {zone.stop === current ? (
              <rect x={x + 1.2} y={BED.top + 1.6} width={Math.min(7, w - 2.4)} height={7} rx={0.6} className="fill-highlight" />
            ) : null}
            <circle cx={mid} cy={BED.bottom - 5} r={2.6} fill={stopColor(zone.stop)} className="stroke-canvas-1" strokeWidth={0.5} />
            <text x={mid} y={BED.bottom - 5} dy="0.36em" textAnchor="middle" fontSize={3} fill={stopForeground(zone.stop)} className="font-display font-bold">
              {zone.stop}
            </text>
          </g>
        )
      })}
      <text x={BED.left} y={37} fontSize={3.2} className="fill-sky-text-2">{frontLabel}</text>
      <text x={BED.right} y={37} fontSize={3.2} textAnchor="end" className="fill-sky-text-2">{doorLabel}</text>
    </svg>
  )
}

/**
 * Tab nhân viên kho: màn xếp hàng thu nhỏ trên máy tính bảng — dải trời có tiến độ đã xếp / tổng, thẻ "Kiện cần xếp" (mã instance,
 * kích thước, khối lượng, điểm giao, vùng và chỗ của vùng trong thùng) với nút "Đối chiếu kiện", cạnh thùng nhìn từ trên. Số từ chuyến
 * mẫu (`roleCargo`): kho xếp ngược thứ tự giao, đã xong hàng của hai điểm cuối tuyến.
 */
export function WarehouseScreen({ cargo }: { cargo: RoleCargo }) {
  const t = useT()
  const format = useFormat()
  const line = cargo.loadingLine
  const name = t(`landing.sample.stop${line.stop as 1 | 2 | 3 | 4}`)
  const place = t(`warehouse.card.zonePlace.${zonePlaceOf(line.stop, cargo.stopCount)}`)
  const size = format.dimensions(line.lengthCm, line.widthCm, line.heightCm)
  const progress = `${format.integer(cargo.loadedCount)} / ${format.integer(cargo.packageCount)}`
  return (
    <>
      <DeviceFrame device="tablet">
        <Screen device="tablet">
          <ScreenBar title={t('landingRoles.frame.trip')} logo={false} className="h-[3.4em]">
            <span className="flex flex-col items-end gap-[0.3em] text-[0.85em]">
              <span className="text-sky-text-2 tabular-nums">
                {t('landingRoles.frame.loaded')} <span className="font-semibold text-sky-text">{progress}</span>
              </span>
              <MiniMeter value={cargo.loadedCount / cargo.packageCount} className="w-[9em] bg-sky-glass" />
            </span>
          </ScreenBar>
          <div className="grid min-h-0 flex-1 grid-cols-[15.5em_minmax(0,1fr)] gap-[0.8em] p-[0.9em]">
            <MiniCard className="flex min-h-0 flex-col gap-[0.45em] p-[0.9em]">
              <span className="text-[0.85em] font-semibold text-ink-3">{t('warehouse.card.title')}</span>
              <span className="font-mono text-[1.5em] leading-tight font-semibold text-ink-strong tabular-nums">{cargo.loadingId}</span>
              <span className="font-mono text-[0.9em] text-ink-2 tabular-nums">{size} · {format.weight(line.weightKg)}</span>
              <span className="mt-[0.3em] flex items-center gap-[0.5em] text-[0.95em] font-semibold text-ink-strong">
                <MiniStop stop={line.stop} />
                {t('warehouse.card.stop', { number: line.stop, name })}
              </span>
              <span className="text-[0.85em] text-ink-2">{t('warehouse.card.zone', { name, place })}</span>
              <MiniPrimary className="mt-auto h-[2.8em]">{t('warehouse.scan.open')}</MiniPrimary>
            </MiniCard>
            <div className="flex min-h-0 flex-col justify-center rounded-[0.8em] bg-canvas-1 p-[0.6em]">
              <BedSketch cargo={cargo} frontLabel={t('landingRoles.frame.front')} doorLabel={t('landingRoles.frame.rearDoor')} />
            </div>
          </div>
        </Screen>
      </DeviceFrame>
      <p className="sr-only">
        {t('landingRoles.text.warehouse', {
          loaded: format.integer(cargo.loadedCount),
          total: format.integer(cargo.packageCount),
          id: cargo.loadingId,
          size,
          weight: format.weight(line.weightKg),
          number: line.stop,
          name,
          place,
          action: t('warehouse.scan.open'),
        })}
      </p>
    </>
  )
}
