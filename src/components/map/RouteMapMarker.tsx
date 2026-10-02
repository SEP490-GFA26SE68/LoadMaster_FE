import { Truck, Warehouse } from 'lucide-react'
import { stopColor, stopForeground } from '@/lib/stops'

const base = 'grid place-items-center border-2 border-bg shadow-e1'

/** Mốc điểm giao: hình tròn màu điểm giao, luôn kèm số (AGENTS mục 10). Trang trí — tên điểm nằm ở danh sách `sr-only` của `RouteMap`. */
export function StopMarker({ number }: { number: number }) {
  return (
    <span
      className={`${base} size-7 rounded-full font-mono text-caption leading-none font-semibold tabular-nums`}
      style={{ background: stopColor(number), color: stopForeground(number) }}
    >
      {number}
    </span>
  )
}

/** Mốc kho xuất phát: ô vuông tối có icon kho — khác hình với điểm giao, không dựa vào màu. */
export function DepotMarker() {
  return (
    <span className={`${base} size-7 rounded-sm bg-ink-strong text-bg`}>
      <Warehouse className="size-4" strokeWidth={1.75} />
    </span>
  )
}

/** Mốc vị trí xe: vòng trắng viền cyan có icon xe. */
export function VehicleMarker() {
  return (
    <span className="grid size-8 place-items-center rounded-full border-2 border-primary bg-bg text-primary shadow-e1">
      <Truck className="size-4" strokeWidth={1.75} />
    </span>
  )
}
