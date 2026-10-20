import type { CSSProperties } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { svgPiece } from '../bento/FeatureVisuals'
import { CheckBadge, FlatQr, LOAD_ORDER, SCENE_HEIGHT, SCENE_WIDTH, StopMark, STOP_FILL } from './scene-kit'
import { groundOf, TruckFrame, type TruckBody } from './truck-side'

/** Thùng xe nhìn ngang: bốn vùng 4 · 3 · 2 · 1 từ cabin ra cửa sau, mỗi vùng hai kiện chồng nhau. */
const BODY: TruckBody = { left: 92, right: 316, top: 52, floor: 160 }
const ZONE = { width: 48, gap: 6, inset: 6 }
const UPPER = { y: 60, height: 44 }
const LOWER = { y: 108, height: 48 }
const GROUND = groundOf(BODY)
/** Kiện của điểm 1 được dỡ: rời ô trên của vùng sát cửa, ra khỏi cửa rồi hạ xuống mặt đường sau xe. */
const FIRST_STOP = 1
const UNLOADED = { x: 330, y: GROUND - UPPER.height }
/**
 * Mốc (ms sau lúc cảnh vào): vùng hiện theo thứ tự xếp, cửa sau, mũi tên dỡ, kiện ra khỏi cửa (600 ms), rồi dấu đối chiếu QR bật ra đúng
 * lúc kiện chạm đất — xong trước 1,5 giây.
 */
const AT = { zone: 60, zoneStep: 70, badgeLag: 120, door: 380, arrow: 500, unload: 600, check: 1140 } as const

function zoneX(order: number): number {
  return BODY.left + ZONE.inset + order * (ZONE.width + ZONE.gap)
}

/**
 * Cảnh "Soạn, xếp, giao, giám sát": xe tải nhìn ngang, vùng hàng 4 · 3 · 2 · 1 từ cabin ra cửa sau (số điểm giao trên đầu mỗi vùng). Tới
 * điểm 1: một kiện của vùng sát cửa ra khỏi cửa theo mũi tên, xuống mặt đường, rồi dấu đối chiếu QR bật ra trên kiện. Chuyển động tắt:
 * kiện đã nằm sau xe, có dấu kiểm.
 */
export function OperateScene({ motion }: { motion: boolean }) {
  const t = useT()
  const door = BODY.right
  const lastX = zoneX(LOAD_ORDER.length - 1)
  const unload = svgPiece(motion, 'lp-unload', AT.unload)
  const unloadStyle = { ...unload.style, '--from-x': `${lastX - UNLOADED.x}px`, '--from-y': `${UPPER.y - UNLOADED.y}px` } as CSSProperties
  return (
    <svg viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`} preserveAspectRatio="xMidYMid meet" className="block size-full">
      <TruckFrame body={BODY} tone="light" groundFrom={8} groundTo={SCENE_WIDTH - 8} />
      <path d={`M${BODY.right} ${BODY.top} H${BODY.left + 5} Q${BODY.left} ${BODY.top} ${BODY.left} ${BODY.top + 5} V${BODY.floor} H${BODY.right}`} className="fill-bg stroke-line-strong" strokeWidth={1.5} />
      {LOAD_ORDER.map((stop, order) => {
        const x = zoneX(order)
        const at = AT.zone + order * AT.zoneStep
        return (
          <g key={stop}>
            <g {...svgPiece(motion, 'lp-lift', at)}>
              {stop === FIRST_STOP ? null : <rect x={x} y={UPPER.y} width={ZONE.width} height={UPPER.height} rx={3} className={cn(STOP_FILL[stop], 'stroke-bg')} strokeWidth={1.5} />}
              <rect x={x} y={LOWER.y} width={ZONE.width} height={LOWER.height} rx={3} className={cn(STOP_FILL[stop], 'stroke-bg')} strokeWidth={1.5} />
            </g>
            <StopMark stop={stop} x={x + ZONE.width / 2} y={BODY.top - 18} r={12} piece={svgPiece(motion, 'lp-pop', at + AT.badgeLag)} />
          </g>
        )
      })}
      <g {...svgPiece(motion, 'lp-fade', AT.door)}>
        <line x1={door} x2={door} y1={BODY.top} y2={BODY.floor} className="stroke-cyan-500" strokeWidth={2.5} strokeDasharray="6 5" strokeLinecap="round" />
        <text x={door + 6} y={BODY.top - 18} dy="0.36em" fontSize={13} className="fill-primary font-semibold">{t('landing.features.zones.door')}</text>
      </g>
      <path d={`M${door + 6} ${UPPER.y + 22} C ${door + 30} ${UPPER.y + 22}, ${UNLOADED.x + 30} ${UPPER.y + 34}, ${UNLOADED.x + 30} ${UNLOADED.y - 12} M${UNLOADED.x + 24} ${UNLOADED.y - 19} L${UNLOADED.x + 30} ${UNLOADED.y - 11} L${UNLOADED.x + 36} ${UNLOADED.y - 19}`}
        pathLength={motion ? 1 : undefined} fill="none" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...svgPiece(motion, 'lp-draw lp-draw-short', AT.arrow, 'stroke-primary')} />
      <g className={unload.className} style={unloadStyle}>
        <rect x={UNLOADED.x} y={UNLOADED.y} width={ZONE.width} height={UPPER.height} rx={3} className={cn(STOP_FILL[FIRST_STOP], 'stroke-bg')} strokeWidth={1.5} />
        <circle cx={UNLOADED.x + 15} cy={UNLOADED.y + UPPER.height / 2} r={10} className="fill-bg" />
        <text x={UNLOADED.x + 15} y={UNLOADED.y + UPPER.height / 2} dy="0.36em" textAnchor="middle" fontSize={13} className="fill-ink-strong font-display font-bold">{FIRST_STOP}</text>
        <FlatQr x={UNLOADED.x + ZONE.width - 21} y={UNLOADED.y + 6} size={16} />
      </g>
      <CheckBadge x={UNLOADED.x + ZONE.width + 2} y={UNLOADED.y + 4} r={9} piece={svgPiece(motion, 'lp-pop', AT.check)} />
    </svg>
  )
}
