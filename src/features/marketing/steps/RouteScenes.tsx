import { useId } from 'react'
import { Truck } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { svgPiece } from '../bento/FeatureVisuals'
import { CheckBadge, SCENE_HEIGHT, SCENE_WIDTH, StopMark, type SceneStop } from './scene-kit'

const VIEW_BOX = `0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`

/** Mảnh bản đồ: thẻ trắng bo góc, đường phố cắt theo mép thẻ. */
const MAP = { x: 4, y: 4, width: SCENE_WIDTH - 8, height: SCENE_HEIGHT - 8, radius: 16 }
/** Đường phố mờ làm nền bản đồ (trang trí, không phải đường đi của xe). */
const STREETS = [
  'M0 120 C 90 104, 150 134, 232 116 S 352 96, 400 108',
  'M244 0 C 236 64, 264 140, 250 220',
  'M74 0 C 92 72, 58 150, 98 220',
] as const
/** Kho rồi bốn điểm giao theo thứ tự đi (sau khi tối ưu tuyến), nối thẳng như bản đồ của Chi tiết chuyến. */
const DEPOT = { x: 40, y: 158 }
const STOPS = [
  { stop: 1, x: 124, y: 72 },
  { stop: 2, x: 200, y: 150 },
  { stop: 3, x: 282, y: 62 },
  { stop: 4, x: 360, y: 138 },
] as const satisfies readonly { stop: SceneStop; x: number; y: number }[]
/** Mốc (ms sau lúc cảnh vào): kho, xe, rồi từng chặng vẽ dần 400 ms gối nhau; điểm giao bật ra khi chặng gần tới nó — xong trước 1,5 giây. */
const PLAN_AT = { depot: 80, truck: 160, leg: 240, legStep: 220, stopLag: 180 } as const

function Depot({ x, y, size, motion, at, label }: { x: number; y: number; size: number; motion: boolean; at: number; label?: string }) {
  const inner = size * 0.32
  return (
    <g {...svgPiece(motion, 'lp-pop', at)}>
      <rect x={x - size / 2} y={y - size / 2} width={size} height={size} rx={size * 0.24} className="fill-panel-dark" />
      <rect x={x - inner / 2} y={y - inner / 2} width={inner} height={inner} rx={2} className="fill-cyan-300" />
      {label ? (
        <text x={x} y={y + size / 2 + 20} textAnchor="middle" fontSize={14} className="fill-ink-2 font-semibold">{label}</text>
      ) : null}
    </g>
  )
}

/**
 * Cảnh "Lập chuyến, tối ưu tuyến": mảnh bản đồ có đường phố mờ, kho có xe đã chọn, rồi tuyến vẽ dần từng chặng qua điểm 1 → 4; mỗi điểm
 * giao bật ra khi chặng tới nó. Chuyển động tắt: tuyến đầy đủ.
 */
export function PlanScene({ motion }: { motion: boolean }) {
  const t = useT()
  const clipId = `lp-plan-map-${useId().replace(/[^\w-]/g, '')}`
  const points = [DEPOT, ...STOPS]
  return (
    <svg viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet" className="block size-full">
      <defs>
        <clipPath id={clipId}>
          <rect x={MAP.x} y={MAP.y} width={MAP.width} height={MAP.height} rx={MAP.radius} />
        </clipPath>
      </defs>
      <g {...svgPiece(motion, 'lp-fade', 0)}>
        <rect x={MAP.x} y={MAP.y} width={MAP.width} height={MAP.height} rx={MAP.radius} className="fill-bg stroke-border" strokeWidth={1} />
        <g clipPath={`url(#${clipId})`}>
          {STREETS.map((d, order) => (
            <path key={order} d={d} fill="none" strokeWidth={order === 2 ? 8 : 11} strokeLinecap="round" className="stroke-n-100" />
          ))}
        </g>
      </g>
      {STOPS.map((to, order) => {
        const from = points[order] ?? DEPOT
        const d = `M${from.x} ${from.y} L${to.x} ${to.y}`
        const at = PLAN_AT.leg + order * PLAN_AT.legStep
        return (
          <g key={to.stop}>
            <path d={d} pathLength={motion ? 1 : undefined} fill="none" strokeWidth={10} strokeLinecap="round" {...svgPiece(motion, 'lp-draw lp-draw-short', at, 'stroke-cyan-100')} />
            <path d={d} pathLength={motion ? 1 : undefined} fill="none" strokeWidth={3} strokeLinecap="round" {...svgPiece(motion, 'lp-draw lp-draw-short', at, 'stroke-primary')} />
          </g>
        )
      })}
      <Depot x={DEPOT.x} y={DEPOT.y} size={32} motion={motion} at={PLAN_AT.depot} label={t('landing.features.route.depot')} />
      <g {...svgPiece(motion, 'lp-pop', PLAN_AT.truck, 'text-primary')}>
        <rect x={DEPOT.x - 21} y={DEPOT.y - 66} width={42} height={34} rx={9} className="fill-bg stroke-border" strokeWidth={1} />
        <Truck x={DEPOT.x - 13} y={DEPOT.y - 62} width={26} height={26} strokeWidth={1.5} />
      </g>
      {STOPS.map(({ stop, x, y }, order) => (
        <StopMark key={stop} stop={stop} x={x} y={y} r={17} piece={svgPiece(motion, 'lp-pop', PLAN_AT.leg + order * PLAN_AT.legStep + PLAN_AT.stopLag)} />
      ))}
    </svg>
  )
}

/** Dòng thời gian của chuyến đã giao: kho rồi bốn điểm cách đều trên một hàng, giữa khung; tờ báo cáo và tên của nó căn giữa bên dưới. */
const LINE_Y = 58
const DONE_DEPOT = { x: 42, y: LINE_Y }
const DONE_STOPS = [1, 2, 3, 4].map((stop, order) => ({ stop: stop as SceneStop, x: 122 + order * 78 }))
const SHEET = { x: SCENE_WIDTH / 2 - 29, y: 96, width: 58, height: 76 }
/** Mốc: kho và điểm hiện dần, đường vẽ qua cả bốn điểm, dấu kiểm bật ra lần lượt, rồi tờ báo cáo nhô lên — xong trước 1,5 giây. */
const DONE_AT = { depot: 40, stop: 80, stopStep: 50, line: 120, check: 420, checkStep: 110, sheet: 860, label: 940 } as const

/**
 * Cảnh câu kết "Chuyến đã giao xong": dòng thời gian kho → điểm 1 → 4, mỗi điểm một dấu kiểm; dưới là tờ báo cáo chuyến. Chuyển động tắt:
 * mọi điểm đã có dấu kiểm.
 */
export function DoneScene({ motion }: { motion: boolean }) {
  const t = useT()
  const end = DONE_STOPS[DONE_STOPS.length - 1]?.x ?? DONE_DEPOT.x
  const line = `M${DONE_DEPOT.x} ${LINE_Y} H${end}`
  const { x, y, width: w, height: h } = SHEET
  const fold = 14
  return (
    <svg viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet" className="block size-full">
      <path d={line} pathLength={motion ? 1 : undefined} fill="none" strokeWidth={10} strokeLinecap="round" {...svgPiece(motion, 'lp-draw', DONE_AT.line, 'stroke-cyan-100')} />
      <path d={line} pathLength={motion ? 1 : undefined} fill="none" strokeWidth={3} strokeLinecap="round" {...svgPiece(motion, 'lp-draw', DONE_AT.line, 'stroke-primary')} />
      <Depot x={DONE_DEPOT.x} y={DONE_DEPOT.y} size={28} motion={motion} at={DONE_AT.depot} />
      {DONE_STOPS.map(({ stop, x: cx }, order) => (
        <g key={stop}>
          <StopMark stop={stop} x={cx} y={LINE_Y} r={16} piece={svgPiece(motion, 'lp-pop', DONE_AT.stop + order * DONE_AT.stopStep)} />
          <CheckBadge x={cx + 13} y={LINE_Y + 13} r={9} piece={svgPiece(motion, 'lp-pop', DONE_AT.check + order * DONE_AT.checkStep)} />
        </g>
      ))}
      <g {...svgPiece(motion, 'lp-lift', DONE_AT.sheet)}>
        <path d={`M${x + 4} ${y} H${x + w - fold} L${x + w} ${y + fold} V${y + h - 4} a4 4 0 0 1 -4 4 H${x + 4} a4 4 0 0 1 -4 -4 V${y + 4} a4 4 0 0 1 4 -4 Z`} className="fill-bg stroke-n-300" strokeWidth={1.5} strokeLinejoin="round" />
        <path d={`M${x + w - fold} ${y} V${y + fold - 3} a3 3 0 0 0 3 3 H${x + w}`} className="fill-n-100 stroke-n-300" strokeWidth={1.5} strokeLinejoin="round" />
        <rect x={x + 10} y={y + 14} width={26} height={7} rx={3.5} className="fill-cyan-300" />
        {[40, 34, 38, 26].map((width, row) => (
          <rect key={row} x={x + 10} y={y + 30 + row * 10} width={width} height={5} rx={2.5} className="fill-n-200" />
        ))}
        <CheckBadge x={x + w - 4} y={y + h - 4} r={10} />
      </g>
      <text x={x + w / 2} y={y + h + 26} textAnchor="middle" fontSize={15} {...svgPiece(motion, 'lp-fade', DONE_AT.label, 'fill-ink-1 font-semibold')}>
        {t('tripReport.title')}
      </text>
    </svg>
  )
}
