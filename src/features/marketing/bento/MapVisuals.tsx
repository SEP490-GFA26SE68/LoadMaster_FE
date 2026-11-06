import { useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'

/** Kho rồi bốn điểm giao theo thứ tự đi, nối thẳng như bản đồ của Chi tiết chuyến; toạ độ trong khung 530 × 150. */
const DEPOT = { x: 30, y: 104 }
const STOPS = [
  { stop: 1, x: 140, y: 50 },
  { stop: 2, x: 262, y: 102 },
  { stop: 3, x: 384, y: 40 },
  { stop: 4, x: 500, y: 94 },
] as const

/** Sơ đồ tuyến của thẻ "Tối ưu tuyến và giám sát" (trang trí): kho, đường đi, số điểm giao trên màu định danh. */
export function RouteVisual() {
  const t = useT()
  const route = [DEPOT, ...STOPS].map((point) => `${point.x},${point.y}`).join(' ')
  return (
    <svg aria-hidden viewBox="0 0 530 150" className="block h-auto w-full">
      <polyline points={route} fill="none" className="stroke-cyan-200" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
      <polyline points={route} fill="none" className="stroke-primary" strokeWidth={2.5} strokeDasharray="1 7" strokeLinecap="round" strokeLinejoin="round" />
      <rect x={DEPOT.x - 16} y={DEPOT.y - 16} width={32} height={32} rx={7} className="fill-panel-dark" />
      <rect x={DEPOT.x - 5} y={DEPOT.y - 5} width={10} height={10} rx={2} className="fill-cyan-300" />
      <text x={DEPOT.x} y={DEPOT.y + 36} textAnchor="middle" fontSize={17} className="fill-ink-2 font-semibold">{t('landing.features.route.depot')}</text>
      {STOPS.map(({ stop, x, y }) => (
        <g key={stop}>
          <circle cx={x} cy={y} r={18} fill={stopColor(stop)} className="stroke-bg" strokeWidth={3} />
          <text x={x} y={y} dy="0.36em" textAnchor="middle" fontSize={18} fill={stopForeground(stop)} className="font-display font-bold">{stop}</text>
        </g>
      ))}
    </svg>
  )
}

/** Thùng nhìn từ trên (vách trước bên trái, cửa sau bên phải) — một khối hàng như nhau mỗi vùng. */
const BODY = { x: 8, y: 18, width: 312, height: 84 }
const ZONES = [
  { stop: 4, from: 0, to: 74, delivered: false },
  { stop: 3, from: 80, to: 152, delivered: false },
  { stop: 2, from: 158, to: 232, delivered: true },
  { stop: 1, from: 238, to: 312, delivered: true },
] as const
/** Kiện nhận dọc đường (toạ độ của khung), xếp vào vùng đã giao xong, không chạm khối hàng còn chở. */
const PICKED = [
  { x: 200, y: 54, width: 32, height: 38 },
  { x: 282, y: 28, width: 30, height: 30 },
  { x: 252, y: 62, width: 28, height: 30 },
  { x: 284, y: 62, width: 28, height: 30 },
] as const

/**
 * Hình của thẻ "Nhận hàng dọc đường" (trang trí): vùng của điểm 1 và 2 đã giao xong thành chỗ trống (viền đứt), kiện mới nằm trong chỗ
 * trống đó; vùng điểm 3, 4 vẫn nguyên.
 */
export function PickupVisual() {
  return (
    <svg aria-hidden viewBox="0 0 360 120" className="block h-auto w-full">
      <rect x={BODY.x} y={BODY.y} width={BODY.width} height={BODY.height} rx={6} className="fill-surface stroke-line-strong" strokeWidth={1.5} />
      {ZONES.map(({ stop, from, to, delivered }) => {
        const x = BODY.x + from + 4
        const width = to - from - 8
        const cx = x + width / 2
        return delivered ? (
          <g key={stop}>
            <rect x={x} y={BODY.y + 6} width={width} height={BODY.height - 12} rx={4} fill="none" className="stroke-line-strong" strokeWidth={1.5} strokeDasharray="5 4" />
            <circle cx={x + 14} cy={BODY.y + 20} r={10} className="fill-bg" stroke={stopColor(stop)} strokeWidth={3} />
            <text x={x + 14} y={BODY.y + 20} dy="0.36em" textAnchor="middle" fontSize={12} className="fill-ink-2 font-display font-bold">{stop}</text>
          </g>
        ) : (
          <g key={stop}>
            <rect x={x} y={BODY.y + 6} width={width} height={BODY.height - 12} rx={4} fill={stopColor(stop)} />
            <circle cx={cx} cy={BODY.y + BODY.height / 2} r={12} className="fill-bg" />
            <text x={cx} y={BODY.y + BODY.height / 2} dy="0.36em" textAnchor="middle" fontSize={13} className="fill-ink-strong font-display font-bold">{stop}</text>
          </g>
        )
      })}
      {PICKED.map((box, index) => (
        <rect key={index} x={box.x} y={box.y} width={box.width} height={box.height} rx={3} className="fill-cyan-100 stroke-cyan-600" strokeWidth={1.5} />
      ))}
      <path d={`M352 ${BODY.y + BODY.height / 2} h-22 m7 -7 l-7 7 l7 7`} fill="none" className="stroke-cyan-600" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
