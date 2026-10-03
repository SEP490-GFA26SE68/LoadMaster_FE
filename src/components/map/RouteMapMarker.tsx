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

/**
 * Mốc vị trí xe: vòng trắng viền cyan có icon xe. `muted` là xe của chuyến khác (màn Giám sát): viền và icon xám, nhỏ hơn một bậc —
 * khác cả cỡ, không chỉ khác màu. `tag` là nhãn ngắn ngay dưới mốc (mã chuyến, nguồn vị trí); mốc vẫn neo đúng tâm vòng tròn.
 */
export function VehicleMarker({ tag, muted = false }: { tag?: string; muted?: boolean }) {
  return (
    <span className="relative grid place-items-center">
      <span className={`grid place-items-center rounded-full border-2 bg-bg shadow-e1 ${muted ? 'size-7 border-n-500 text-ink-2' : 'size-8 border-primary text-primary'}`}>
        <Truck className="size-4" strokeWidth={1.75} />
      </span>
      {tag ? (
        <span className="absolute top-full mt-1 rounded-sm border border-border bg-bg px-1.5 py-0.5 text-micro font-medium whitespace-nowrap text-ink-1 shadow-e1">
          {tag}
        </span>
      ) : null}
    </span>
  )
}
