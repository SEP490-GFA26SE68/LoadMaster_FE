import type { CSSProperties } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import { useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { cn } from '@/lib/utils'
import type { TripStatus } from '@/types/trip'
import { CARGO, TRUCK_VIEW, TRUCK_ZONES, truckBoxes } from './journey-model'

const BOXES = truckBoxes()
const FLOOR = CARGO.y + CARGO.height
const BODY = { x: CARGO.x - 8, y: CARGO.y - 8, right: CARGO.x + CARGO.width + 8 }
const ROAD_Y = 258
const WHEELS = [96, 548, 618] as const

/**
 * Chip trạng thái chuyến theo chặng đang xem (`data-chapter` của phần): Đã lập kế hoạch → Đang xếp hàng → Đang vận chuyển (hai chặng) →
 * Đã giao. CSS chỉ hiện chip của chặng đang xem; chưa có tiến độ (không JS, không IntersectionObserver) thì là Đang vận chuyển — khớp
 * thùng đầy mặc định.
 */
const CHIPS: readonly { status: TripStatus; chapters: string }[] = [
  { status: 'PLANNED', chapters: '0' },
  { status: 'LOADING', chapters: '1' },
  { status: 'IN_TRANSIT', chapters: '2 3' },
  { status: 'DELIVERED', chapters: '4' },
]

/** Cabin nhìn ngang, mũi xe bên trái: kính chắn gió, cửa, bậc lên xuống. */
function Cab() {
  return (
    <g>
      <path d={`M${BODY.x - 4} ${FLOOR + 14} V96 H70 Q52 96 44 112 L26 150 Q22 158 22 168 V${FLOOR + 14} Z`} className="fill-cyan-700" />
      <path d="M62 108 H140 V146 H40 L52 118 Q56 108 62 108 Z" className="fill-cyan-100" />
      <rect x={96} y={154} width={40} height={4} rx={2} className="fill-cyan-900" />
      <rect x={22} y={FLOOR - 2} width={18} height={10} rx={2} className="fill-amber-200" />
    </g>
  )
}

/**
 * Hình thùng xe nhìn ngang của "Một chuyến hàng" (trang trí, `aria-hidden` — chữ của từng chặng đã nói điều hình vẽ): cabin bên trái,
 * cửa sau bên phải, bốn vùng theo điểm giao (số trên màu định danh, điểm 4 sâu nhất) và các kiện của từng vùng. Khung nét đứt là chỗ của
 * kiện trong phương án; CSS đọc tiến độ cuộn `--p` của phần để cho kiện lên xe ở chặng kho (vùng sâu nhất trước, trượt vào từ cửa) và
 * xuống xe ở chặng điểm giao (vùng sát cửa trước), cho vạch đường chạy khi xe lăn bánh và mở cửa sau ở chặng kho, chặng điểm giao.
 */
export function JourneyTruck({ className }: { className?: string }) {
  const t = useT()
  return (
    <div aria-hidden className={cn('flex flex-col gap-2 sm:gap-3', className)}>
      <div className="flex min-h-7 items-center justify-between gap-3">
        <span className="flex">
          {CHIPS.map(({ status, chapters }) => (
            <span key={status} data-for={chapters} className="journey-chip">
              <StatusBadge status={status} className="pointer-coarse:text-body-lg" />
            </span>
          ))}
        </span>
        <span className="text-small whitespace-nowrap text-ink-3 pointer-coarse:text-body-lg">{t('landingJourney.truck.door')}</span>
      </div>
      <svg viewBox={`0 0 ${TRUCK_VIEW.width} ${TRUCK_VIEW.height}`} className="block h-auto w-full">
        <line x1={0} x2={TRUCK_VIEW.width} y1={ROAD_Y} y2={ROAD_Y} className="stroke-border" strokeWidth={2} />
        <line x1={0} x2={TRUCK_VIEW.width} y1={ROAD_Y + 12} y2={ROAD_Y + 12} className="journey-road stroke-line-strong" strokeWidth={3} strokeDasharray="28 22" />
        <rect x={20} y={FLOOR + 8} width={BODY.right - 20} height={12} rx={3} className="fill-n-700" />
        <Cab />
        <rect x={BODY.x} y={BODY.y} width={BODY.right - BODY.x} height={FLOOR + 8 - BODY.y} rx={8} className="fill-bg stroke-n-300" strokeWidth={2} />
        {TRUCK_ZONES.map(({ stop, x, width }) => (
          <g key={stop}>
            <rect x={x} y={CARGO.y} width={width} height={CARGO.height} rx={3} className="fill-surface" />
            <circle cx={x + width / 2} cy={14} r={11} fill={stopColor(stop)} />
            <text x={x + width / 2} y={14} dy="0.36em" textAnchor="middle" fontSize={13} fill={stopForeground(stop)} className="font-display font-bold">{stop}</text>
          </g>
        ))}
        {BOXES.map((box) => (
          <rect key={`slot-${box.id}`} x={box.x + 1} y={box.y + 1} width={box.width - 2} height={box.height - 2} rx={2} fill="none" className="stroke-n-300" strokeWidth={1.25} strokeDasharray="4 3" />
        ))}
        {BOXES.map((box) => (
          <rect key={box.id} x={box.x} y={box.y} width={box.width} height={box.height} rx={2} fill={stopColor(box.stop)}
            className="journey-box stroke-bg" strokeWidth={1.5} style={{ '--on': box.on, '--off': box.off } as CSSProperties} />
        ))}
        <rect x={BODY.right - 8} y={BODY.y} width={8} height={FLOOR + 8 - BODY.y} rx={2} className="journey-door-closed fill-cyan-400" />
        <path d={`M${BODY.right} ${BODY.y} l26 18 V${FLOOR - 4} l-26 12 Z`} className="journey-door-open fill-cyan-100 stroke-cyan-400" strokeWidth={2} />
        {WHEELS.map((cx) => (
          <g key={cx}>
            <circle cx={cx} cy={ROAD_Y - 18} r={18} className="fill-n-800" />
            <circle cx={cx} cy={ROAD_Y - 18} r={7} className="fill-n-300" />
          </g>
        ))}
      </svg>
    </div>
  )
}
