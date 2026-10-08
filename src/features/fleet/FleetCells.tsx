import { useFormat, useT } from '@/lib/i18n'
import type { VehicleRow } from './vehicle-status'
import { topViewOf } from './vehicle-top-view'

/** Số và đơn vị ở hai độ đậm khác nhau: "6.000 kg" → ["6.000", "kg"]. Chuỗi không có đơn vị thì đơn vị rỗng. */
export function splitUnit(text: string): readonly [value: string, unit: string] {
  const cut = text.lastIndexOf(' ')
  return cut === -1 ? [text, ''] : [text.slice(0, cut), text.slice(cut + 1)]
}

/**
 * Tên xe trong ô phương tiện (V2.3, DoiXe.jpg): tên đậm, biển số mono và không bị bẻ giữa chừng (như `VehicleName`, tách ở " · ").
 * Chỉ ruột của liên kết — mã xe ở dòng dưới do cột dựng.
 */
export function VehicleNameText({ name }: { name: string }) {
  const cut = name.lastIndexOf(' · ')
  if (cut === -1) return name
  return (
    <>
      {name.slice(0, cut)} · <span className="font-mono text-caption font-medium whitespace-nowrap">{name.slice(cut + 3)}</span>
    </>
  )
}

/** Hình lòng thùng nhìn từ trên, vẽ đúng tỉ lệ từ dữ liệu xe (`topViewOf`): vật cản xám, cạnh cửa sau cyan. Trang trí — số đo nằm ở chữ bên cạnh. */
export function TopViewFigure({ vehicle }: { vehicle: Pick<VehicleRow, 'innerLengthCm' | 'innerWidthCm' | 'obstacles'> }) {
  const view = topViewOf(vehicle)
  return (
    <svg
      aria-hidden
      width={view.width}
      height={view.height}
      viewBox={`0 0 ${view.width} ${view.height}`}
      className="flex-none overflow-visible"
    >
      <rect x={0.5} y={0.5} width={view.width - 1} height={view.height - 1} className="fill-n-50 stroke-n-400" strokeWidth={1} rx={1.5} />
      {view.obstacles.map((rect, index) => (
        <rect key={index} {...rect} className="fill-(--obstacle)" />
      ))}
      <rect {...view.door} className="fill-cyan-500" />
    </svg>
  )
}

/** Cột lòng thùng: hình từ trên cạnh số đo (dài × rộng × cao) và thể tích m³ — thể tích là tích ba số đo của xe, không số nào khác. */
export function CargoBoxCell({ vehicle }: { vehicle: VehicleRow }) {
  const format = useFormat()
  const volume = vehicle.innerLengthCm * vehicle.innerWidthCm * vehicle.innerHeightCm
  return (
    <span className="flex items-center gap-4">
      <span className="flex w-32 flex-none items-center">
        <TopViewFigure vehicle={vehicle} />
      </span>
      <span className="flex flex-col whitespace-nowrap">
        <span className="font-mono text-caption text-ink-1">
          {format.dimensions(vehicle.innerLengthCm, vehicle.innerWidthCm, vehicle.innerHeightCm)}
        </span>
        <span className="font-mono text-caption text-ink-3">{format.volumeM3(volume)}</span>
      </span>
    </span>
  )
}

/** Tải tối đa: số đậm, đơn vị nhạt hơn. */
export function PayloadCell({ kilograms }: { kilograms: number }) {
  const format = useFormat()
  const [value, unit] = splitUnit(format.weight(kilograms))
  return (
    <span className="font-mono text-body">
      <span className="font-semibold text-ink-strong">{value}</span>
      {unit ? <span className="text-ink-3"> {unit}</span> : null}
    </span>
  )
}

/** Vật cản: số vùng ở dòng trên, các loại đã khai ở dòng dưới (mỗi loại một lần). */
export function ObstacleCell({ vehicle }: { vehicle: VehicleRow }) {
  const t = useT()
  const kinds = [...new Set(vehicle.obstacles.map((obstacle) => obstacle.type))]
  return (
    <span className="flex min-w-0 flex-col whitespace-normal">
      <span className="text-body text-ink-1">{t('fleet.obstacleZones', { count: vehicle.obstacles.length })}</span>
      {kinds.length > 0 ? (
        <span className="line-clamp-2 text-caption text-ink-3">{kinds.map((kind) => t(`viewer.obstacles.types.${kind}`)).join(', ')}</span>
      ) : null}
    </span>
  )
}
