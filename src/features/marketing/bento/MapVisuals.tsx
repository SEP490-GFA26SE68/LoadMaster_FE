import { useId } from 'react'
import { useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { useRevealMotion } from '../reveal'
import { svgPiece } from './FeatureVisuals'

/** Kho rồi bốn điểm giao theo thứ tự đi, nối thẳng như bản đồ của Chi tiết chuyến; toạ độ trong khung 530 × 150. */
const DEPOT = { x: 30, y: 104 }
const STOPS = [
  { stop: 1, x: 140, y: 50 },
  { stop: 2, x: 262, y: 102 },
  { stop: 3, x: 384, y: 40 },
  { stop: 4, x: 500, y: 94 },
] as const
const ROUTE = `M${[DEPOT, ...STOPS].map((point) => `${point.x} ${point.y}`).join(' L')}`
/** Mốc của tuyến (ms sau lúc ô bắt đầu): kho bật ra, bốn điểm bật ra cách nhau 80 ms, rồi đường vẽ dần qua chúng trong 900 ms. */
const ROUTE_AT = { depot: 150, stop: 230, stopStep: 80, draw: 300 } as const

/**
 * Sơ đồ tuyến của thẻ "Tối ưu tuyến và giám sát" (trang trí): kho, đường đi, số điểm giao trên màu định danh. Chuyển động bật: đường chấm
 * hiện dần theo một mặt nạ vẽ cùng nhịp với nét nền, nên mảng nét `1 7` của nó giữ nguyên.
 */
export function RouteVisual() {
  const t = useT()
  const motion = useRevealMotion()
  const maskId = `lp-route-${useId().replace(/[^\w-]/g, '')}`
  return (
    <svg aria-hidden viewBox="0 0 530 150" className="block h-auto w-full">
      {motion ? (
        <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={530} height={150}>
          {/* Mặt nạ: trắng là hiện */}
          <path d={ROUTE} pathLength={1} fill="none" stroke="#fff" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" {...svgPiece(motion, 'lp-draw', ROUTE_AT.draw)} />
        </mask>
      ) : null}
      <path d={ROUTE} pathLength={motion ? 1 : undefined} fill="none" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" {...svgPiece(motion, 'lp-draw', ROUTE_AT.draw, 'stroke-cyan-200')} />
      <path d={ROUTE} mask={motion ? `url(#${maskId})` : undefined} fill="none" className="stroke-primary" strokeWidth={2.5} strokeDasharray="1 7" strokeLinecap="round" strokeLinejoin="round" />
      <g {...svgPiece(motion, 'lp-pop', ROUTE_AT.depot)}>
        <rect x={DEPOT.x - 16} y={DEPOT.y - 16} width={32} height={32} rx={7} className="fill-panel-dark" />
        <rect x={DEPOT.x - 5} y={DEPOT.y - 5} width={10} height={10} rx={2} className="fill-cyan-300" />
        <text x={DEPOT.x} y={DEPOT.y + 36} textAnchor="middle" fontSize={17} className="fill-ink-2 font-semibold">{t('landing.features.route.depot')}</text>
      </g>
      {STOPS.map(({ stop, x, y }, index) => (
        <g key={stop} {...svgPiece(motion, 'lp-pop', ROUTE_AT.stop + index * ROUTE_AT.stopStep)}>
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
/** Mũi tên vào cửa sau vẽ dần (400 ms), rồi từng kiện nhận phồng lên một lần, cách nhau 70 ms. */
const PICKUP_AT = { arrow: 200, pulse: 650, pulseStep: 70 } as const

/**
 * Hình của thẻ "Nhận hàng dọc đường" (trang trí): vùng của điểm 1 và 2 đã giao xong thành chỗ trống (viền đứt), kiện mới nằm trong chỗ
 * trống đó; vùng điểm 3, 4 vẫn nguyên.
 */
export function PickupVisual() {
  const motion = useRevealMotion()
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
        <rect key={index} x={box.x} y={box.y} width={box.width} height={box.height} rx={3} strokeWidth={1.5}
          {...svgPiece(motion, 'lp-pulse', PICKUP_AT.pulse + index * PICKUP_AT.pulseStep, 'fill-cyan-100 stroke-cyan-600')} />
      ))}
      <path d={`M352 ${BODY.y + BODY.height / 2} h-22 m7 -7 l-7 7 l7 7`} pathLength={motion ? 1 : undefined} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
        {...svgPiece(motion, 'lp-draw lp-draw-short', PICKUP_AT.arrow, 'stroke-cyan-600')} />
    </svg>
  )
}
