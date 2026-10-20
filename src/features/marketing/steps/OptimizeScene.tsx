import { PLAN_LABELS, PLAN_OBJECTIVES } from '@/domain/models'
import { createProjector, type Projector } from '@/lib/isometric'
import { useT } from '@/lib/i18n'
import { svgPiece } from '../bento/FeatureVisuals'
import { byDepth, CheckBadge, IsoBlock, LOAD_ORDER, SCENE_HEIGHT, SCENE_WIDTH, StopMark, stopRadius, stopTone, useSceneFont, type SceneBox, type SceneStop } from './scene-kit'

/** Ba thẻ cạnh nhau như màn So sánh phương án; thùng thu nhỏ dài 4,2 × rộng 1,6 × cao 1,7 (đơn vị hình). */
const CARD = { width: 116, height: 154, gap: 10, y: 14 }
const LEFT = (SCENE_WIDTH - CARD.width * 3 - CARD.gap * 2) / 2
const BODY = { length: 4.2, width: 1.6, height: 1.7 }
const SCALE = 19
const ROWS = [
  { y: 0.04, w: 0.74 },
  { y: 0.82, w: 0.74 },
] as const
/** Phương án được duyệt trong hình: ít dỡ-xếp lại (C), như bản điều phối viên duyệt của chuyến mẫu. */
const APPROVED = 'MIN_REHANDLING'
/** Cỡ thiết kế: chữ cái trong ô 24 × 24, nhãn "Đã duyệt" 64 × 20 ở góc phải trên của thẻ, chú giải bốn mốc bán kính 11 cách nhau 30. */
const LETTER = { font: 14, box: 24 }
const TAG = { font: 11.5, width: 64, height: 20 }
const LEGEND = { r: 11, step: 30, y: 196 }
/**
 * Nhãn "Đã duyệt" lớn hơn cỡ thiết kế (máy cảm ứng) không còn vừa cạnh chữ cái: nằm giữa viền dưới của thẻ, rộng theo chữ (ước lượng
 * 0,62 em mỗi ký tự, không quá thẻ).
 */
function ribbonWidth(label: string, font: number): number {
  return Math.min(CARD.width - 8, Math.ceil(label.length * font * 0.62) + 16)
}

/** Một dòng hàng: khối (x, dài, hàng ngang, cao, điểm giao). */
type Cargo = readonly [x: number, l: number, row: 0 | 1, h: number, stop: SceneStop]

/** Tối đa thể tích: sáu cột cao kín thùng, màu điểm giao xen nhau. */
const MAX_VOLUME: Cargo[] = [4, 2, 4, 3, 1, 2, 3, 4, 1, 2, 3, 1].map((stop, index) => {
  const column = index % 6
  return [0.04 + column * 0.69, 0.66, index < 6 ? 0 : 1, 1.5, stop as SceneStop] as const
})
/** Cân bằng tải trục: bốn cột dồn giữa thùng, thấp hơn. */
const AXLE_BALANCE: Cargo[] = [3, 4, 2, 1, 4, 3, 1, 2].map((stop, index) => {
  const column = index % 4
  return [0.5 + column * 0.8, 0.76, index < 4 ? 0 : 1, 1.05, stop as SceneStop] as const
})
/** Ít dỡ-xếp lại: bốn vùng theo điểm giao, điểm 4 sát vách trước, điểm 1 sát cửa sau; hàng thấp dần về phía cửa. */
const MIN_REHANDLING: Cargo[] = LOAD_ORDER.flatMap((stop, zone) => {
  const height = [1.3, 1.15, 1, 0.85][zone] ?? 1
  return ([0, 1] as const).map((row) => [0.04 + zone * 1.04, 0.98, row, height, stop] as const)
})
const LAYOUTS = { MAX_VOLUME, AXLE_BALANCE, MIN_REHANDLING } as const satisfies Record<(typeof PLAN_OBJECTIVES)[number], Cargo[]>

/**
 * Mốc (ms sau lúc cảnh vào): thẻ nhô lên cách nhau 100 ms, hàng trong thẻ hiện theo thứ tự xếp; rồi vòng duyệt, dấu kiểm và nhãn của C —
 * xong trước 1,5 giây.
 */
const AT = { card: 40, cardStep: 100, cargo: 100, cargoStep: 18, legend: 600, ring: 860, tag: 920, check: 1000 } as const

function shellFaces(project: Projector) {
  const { length: l, width: w, height: h } = BODY
  return [
    { points: [project(0, 0, 0), project(l, 0, 0), project(l, w, 0), project(0, w, 0)].join(' '), className: 'fill-n-100' },
    { points: [project(0, 0, 0), project(0, w, 0), project(0, w, h), project(0, 0, h)].join(' '), className: 'fill-n-50' },
    { points: [project(0, 0, 0), project(l, 0, 0), project(l, 0, h), project(0, 0, h)].join(' '), className: 'fill-n-50' },
  ]
}

function boxesOf(layout: Cargo[]): SceneBox[] {
  return byDepth(
    layout.map(([x, l, row, h, stop]) => ({ x, y: ROWS[row].y, z: 0, l, w: ROWS[row].w, h, tone: stopTone(stop) })),
  )
}

/** Một thẻ phương án: chữ cái A · B · C, thùng thu nhỏ đẳng cự với hàng tô theo điểm giao. */
function PlanCard({ objective, order, motion, approved }: { objective: (typeof PLAN_OBJECTIVES)[number]; order: number; motion: boolean; approved: string }) {
  const x = LEFT + order * (CARD.width + CARD.gap)
  const { y, width, height } = CARD
  const project = createProjector(SCALE, x + 36.6, y + 83.6)
  const at = AT.card + order * AT.cardStep
  const isApproved = objective === APPROVED
  const letterFont = useSceneFont(LETTER.font)
  const box = Math.max(LETTER.box, letterFont + 10)
  const tagFont = useSceneFont(TAG.font)
  const ribbon = tagFont > TAG.font
  const tagWidth = ribbon ? ribbonWidth(approved, tagFont) : TAG.width
  const tagHeight = Math.max(TAG.height, tagFont + 8)
  const tag = ribbon ? { x: x + (width - tagWidth) / 2, y: y + height - tagHeight / 2 } : { x: x + width - 10 - tagWidth, y: y + 12 }
  return (
    <g>
      {isApproved ? (
        <rect x={x - 4} y={y - 4} width={width + 8} height={height + 8} rx={15} fill="none" strokeWidth={2.5} {...svgPiece(motion, 'lp-fade', AT.ring, 'stroke-cyan-400')} />
      ) : null}
      <g {...svgPiece(motion, 'lp-lift', at)}>
        <rect x={x} y={y} width={width} height={height} rx={11} className="fill-bg stroke-border" strokeWidth={1} />
        <rect x={x + 10} y={y + 10} width={box} height={box} rx={6} className="fill-tint-blue" />
        <text x={x + 10 + box / 2} y={y + 10 + box / 2} dy="0.36em" textAnchor="middle" fontSize={letterFont} className="fill-tint-blue-fg font-display font-bold">{PLAN_LABELS[objective]}</text>
        {shellFaces(project).map((face, index) => (
          <polygon key={index} points={face.points} className={`${face.className} stroke-n-300`} strokeWidth={0.75} strokeLinejoin="round" />
        ))}
      </g>
      {boxesOf(LAYOUTS[objective]).map((box, index) => (
        <IsoBlock key={index} box={box} project={project} piece={svgPiece(motion, 'lp-lift', at + AT.cargo + index * AT.cargoStep)} />
      ))}
      {isApproved ? (
        <>
          <g {...svgPiece(motion, 'lp-fade', AT.tag)}>
            <rect x={tag.x} y={tag.y} width={tagWidth} height={tagHeight} rx={6} className="fill-badge-cyan-bg" />
            <text x={tag.x + tagWidth / 2} y={tag.y + tagHeight / 2} dy="0.36em" textAnchor="middle" fontSize={tagFont} className="fill-badge-cyan-fg font-semibold">{approved}</text>
          </g>
          <CheckBadge x={x + width} y={y} r={11} piece={svgPiece(motion, 'lp-pop', AT.check)} />
        </>
      ) : null}
    </g>
  )
}

/**
 * Cảnh "Xếp 3D, so sánh, duyệt": ba phương án A · B · C của một lần chạy cạnh nhau, mỗi phương án một thùng thu nhỏ — A kín thùng, B dồn
 * giữa thùng, C chia vùng theo điểm giao; C nhận vòng cyan, nhãn "Đã duyệt" và dấu kiểm. Hàng chú giải bốn điểm giao có số dưới thẻ.
 * Máy cảm ứng (`SceneTextFloor`): chữ cái, nhãn và số chú giải lớn lên cùng ô của chúng; nhãn "Đã duyệt" xuống giữa viền dưới thẻ C.
 */
export function OptimizeScene({ motion }: { motion: boolean }) {
  const t = useT()
  const approved = t('trips.compare.candidates.approved')
  // Chú giải: mốc lớn theo số thì cách nhau ít nhất 2r + 6; giữa khung, trừ khi chạm nhãn "Đã duyệt" nằm ở viền dưới thẻ C — lùi sang trái
  const tagFont = useSceneFont(TAG.font)
  const legendR = stopRadius(LEGEND.r, useSceneFont(Math.round(LEGEND.r * 1.1)))
  const step = Math.max(LEGEND.step, 2 * legendR + 6)
  const approvedX = LEFT + PLAN_OBJECTIVES.indexOf(APPROVED) * (CARD.width + CARD.gap)
  const ribbonLeft = tagFont > TAG.font ? approvedX + (CARD.width - ribbonWidth(approved, tagFont)) / 2 : SCENE_WIDTH
  const center = Math.min(SCENE_WIDTH / 2, ribbonLeft - 4 - legendR - 1.5 * step)
  return (
    <svg viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`} preserveAspectRatio="xMidYMid meet" className="block size-full">
      {PLAN_OBJECTIVES.map((objective, order) => (
        <PlanCard key={objective} objective={objective} order={order} motion={motion} approved={approved} />
      ))}
      {([1, 2, 3, 4] as const).map((stop, order) => (
        <StopMark key={stop} stop={stop} x={center + (order - 1.5) * step} y={LEGEND.y} r={LEGEND.r} piece={svgPiece(motion, 'lp-fade', AT.legend)} />
      ))}
    </svg>
  )
}
