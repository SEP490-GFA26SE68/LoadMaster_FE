import { useId } from 'react'
import { StopDot } from '@/components/StopChip'
import { useT } from '@/lib/i18n'
import { stopColor } from '@/lib/stops'
import { cn } from '@/lib/utils'
import { useRevealMotion } from '../reveal'
import { svgPiece } from './FeatureVisuals'

/** Vị trí trong khung hình theo phần trăm, để đặt chữ HTML đúng chỗ dù hình co giãn. */
function percent(value: number, total: number): string {
  return `${((value / total) * 100).toFixed(3)}%`
}

/** Hình không giãn quá 40rem (màn rộng), canh giữa ô: nét và ô kho không phình theo bề rộng của thẻ. */
const DRAWING = 'mx-auto w-full max-w-[40rem]'

/** Kho rồi bốn điểm giao theo thứ tự đi, nối thẳng như bản đồ của Chi tiết chuyến; toạ độ trong khung 530 × 150. */
const ROUTE_VIEW = { width: 530, height: 150 }
const DEPOT = { x: 30, y: 104, half: 16 }
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
 * Sơ đồ tuyến của thẻ "Tối ưu tuyến và giám sát" (trang trí, `aria-hidden`): kho, đường đi, số điểm giao trên màu định danh. Đường và ô kho
 * nằm trong SVG; nhãn kho và số điểm giao là HTML đặt lên hình theo phần trăm (như `StatementTruck`): hình co theo bề rộng, chữ giữ cỡ của
 * trang — nhãn kho 13 px, số điểm 16 px, 16 px cả hai trên máy cảm ứng. Chuyển động bật: đường chấm hiện dần theo một mặt nạ vẽ cùng nhịp
 * với nét nền, nên mảng nét `1 7` của nó giữ nguyên; kho và từng điểm bật ra (`lp-pop` chạy được trên phần tử HTML).
 */
export function RouteVisual() {
  const t = useT()
  const motion = useRevealMotion()
  const maskId = `lp-route-${useId().replace(/[^\w-]/g, '')}`
  const depot = svgPiece(motion, 'lp-pop', ROUTE_AT.depot)
  const { width, height } = ROUTE_VIEW
  return (
    // Lề dưới giữ chỗ cho nhãn kho: trên điện thoại hình chỉ còn khoảng 60 %, nhãn 16 px cao hơn phần hình còn lại dưới ô kho
    <div aria-hidden className={cn(DRAWING, 'pb-3')}>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full">
          {motion ? (
            <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={width} height={height}>
              {/* Mặt nạ: trắng là hiện */}
              <path d={ROUTE} pathLength={1} fill="none" stroke="#fff" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" {...svgPiece(motion, 'lp-draw', ROUTE_AT.draw)} />
            </mask>
          ) : null}
          <path d={ROUTE} pathLength={motion ? 1 : undefined} fill="none" strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" {...svgPiece(motion, 'lp-draw', ROUTE_AT.draw, 'stroke-cyan-200')} />
          <path d={ROUTE} mask={motion ? `url(#${maskId})` : undefined} fill="none" className="stroke-primary" strokeWidth={2.5} strokeDasharray="1 7" strokeLinecap="round" strokeLinejoin="round" />
          <g {...depot}>
            <rect x={DEPOT.x - DEPOT.half} y={DEPOT.y - DEPOT.half} width={DEPOT.half * 2} height={DEPOT.half * 2} rx={7} className="fill-panel-dark" />
            <rect x={DEPOT.x - 5} y={DEPOT.y - 5} width={10} height={10} rx={2} className="fill-cyan-300" />
          </g>
        </svg>
        {/* Nhãn kho canh giữa dưới ô kho; chữ dài hơn ô (điện thoại, tiếng Anh) thì canh mép trái hình thay vì tràn ra ngoài */}
        <span className={cn('absolute left-0 flex justify-center-safe pt-1', depot.className)}
          style={{ width: percent(DEPOT.x * 2, width), top: percent(DEPOT.y + DEPOT.half, height), ...depot.style }}>
          <span className="text-small font-semibold whitespace-nowrap text-ink-2 pointer-coarse:text-body-lg">{t('landing.features.route.depot')}</span>
        </span>
        {STOPS.map(({ stop, x, y }, index) => {
          const piece = svgPiece(motion, 'lp-pop', ROUTE_AT.stop + index * ROUTE_AT.stopStep)
          return (
            <span key={stop} className={cn('absolute -translate-x-1/2 -translate-y-1/2', piece.className)}
              style={{ left: percent(x, width), top: percent(y, height), ...piece.style }}>
              {/* Từ 640 px hình rộng hơn: chấm 32 px cho cân với ô kho, số vẫn 16 px */}
              <StopDot stop={stop} className="ring-3 ring-bg sm:size-8" />
            </span>
          )
        })}
      </div>
    </div>
  )
}

/** Thùng nhìn từ trên (vách trước bên trái, cửa sau bên phải) — một khối hàng như nhau mỗi vùng; toạ độ trong khung 360 × 120. */
const PICKUP_VIEW = { width: 360, height: 120 }
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

/** Ô của một vùng trong thùng (lùi 4 đơn vị mỗi bên) và tâm số điểm: vùng đã giao để số ở góc trên trái, chừa chỗ cho kiện nhận. */
function zoneBox({ from, to, delivered }: (typeof ZONES)[number]) {
  const x = BODY.x + from + 4
  const width = to - from - 8
  const mark = delivered ? { x: x + 15, y: BODY.y + 21 } : { x: x + width / 2, y: BODY.y + BODY.height / 2 }
  return { x, width, mark }
}

/**
 * Hình của thẻ "Nhận hàng dọc đường" (trang trí, `aria-hidden`): vùng của điểm 1 và 2 đã giao xong thành chỗ trống (viền đứt), kiện mới
 * nằm trong chỗ trống đó; vùng điểm 3, 4 vẫn nguyên. Số điểm là HTML đặt lên hình theo phần trăm, giữ 13 px (16 px trên máy cảm ứng) dù
 * hình co giãn; vùng đã giao có vòng màu điểm giao quanh số.
 */
export function PickupVisual() {
  const motion = useRevealMotion()
  const { width, height } = PICKUP_VIEW
  return (
    <div aria-hidden className={cn(DRAWING, 'relative')}>
      <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full">
        <rect x={BODY.x} y={BODY.y} width={BODY.width} height={BODY.height} rx={6} className="fill-surface stroke-line-strong" strokeWidth={1.5} />
        {ZONES.map((zone) => {
          const box = zoneBox(zone)
          return zone.delivered ? (
            <rect key={zone.stop} x={box.x} y={BODY.y + 6} width={box.width} height={BODY.height - 12} rx={4} fill="none" className="stroke-line-strong" strokeWidth={1.5} strokeDasharray="5 4" />
          ) : (
            <rect key={zone.stop} x={box.x} y={BODY.y + 6} width={box.width} height={BODY.height - 12} rx={4} fill={stopColor(zone.stop)} />
          )
        })}
        {PICKED.map((box, index) => (
          <rect key={index} x={box.x} y={box.y} width={box.width} height={box.height} rx={3} strokeWidth={1.5}
            {...svgPiece(motion, 'lp-pulse', PICKUP_AT.pulse + index * PICKUP_AT.pulseStep, 'fill-cyan-100 stroke-cyan-600')} />
        ))}
        <path d={`M352 ${BODY.y + BODY.height / 2} h-22 m7 -7 l-7 7 l7 7`} pathLength={motion ? 1 : undefined} fill="none" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
          {...svgPiece(motion, 'lp-draw lp-draw-short', PICKUP_AT.arrow, 'stroke-cyan-600')} />
      </svg>
      {ZONES.map((zone) => {
        const { mark } = zoneBox(zone)
        return (
          <span key={zone.stop}
            className={cn('absolute grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-bg font-display text-small leading-none font-bold pointer-coarse:size-7 pointer-coarse:text-body-lg',
              zone.delivered ? 'text-ink-2' : 'text-ink-strong')}
            style={{ left: percent(mark.x, width), top: percent(mark.y, height), boxShadow: zone.delivered ? `inset 0 0 0 3px ${stopColor(zone.stop)}` : undefined }}>
            {zone.stop}
          </span>
        )
      })}
    </div>
  )
}
