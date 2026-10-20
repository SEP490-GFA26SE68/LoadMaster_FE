import { Clock, MapPin, Package } from 'lucide-react'
import type { CSSProperties } from 'react'
import { createProjector } from '@/lib/isometric'
import { useT } from '@/lib/i18n'
import { svgPiece } from '../bento/FeatureVisuals'
import { CheckBadge, FlatQr, IsoBlock, IsoQr, NEUTRAL_TONE, SCENE_HEIGHT, SCENE_WIDTH, useSceneFont, type SceneBox } from './scene-kit'

/** Bốn kiện mới nhập (mét, như `lib/isometric`): một kiện chồng lên kiện sau, hai kiện đứng trước. Thứ tự vẽ xa trước gần sau. */
const PROJECT = createProjector(52, 97.5, 113.5)
const PACKAGES = [
  { x: 0, y: 0, z: 0, l: 1.1, w: 0.9, h: 0.8, tone: NEUTRAL_TONE },
  { x: 1.25, y: 0, z: 0, l: 0.8, w: 0.75, h: 0.6, tone: NEUTRAL_TONE },
  { x: 0.15, y: 0.1, z: 0.8, l: 0.7, w: 0.65, h: 0.55, tone: NEUTRAL_TONE },
  { x: 0.1, y: 1.05, z: 0, l: 0.8, w: 0.8, h: 0.7, tone: NEUTRAL_TONE },
] as const satisfies readonly SceneBox[]
/** Nhãn QR của ba kiện còn thấy mặt: mặt và hai góc (trải, cao) trên mặt đó. Nhãn cuối là nhãn được quét. */
const LABELS = [
  { face: 'x', at: 2.05, from: [0.2, 0.12], to: [0.55, 0.47] },
  { face: 'x', at: 0.85, from: [0.27, 0.9], to: [0.6, 1.23] },
  { face: 'y', at: 1.85, from: [0.32, 0.14], to: [0.72, 0.54] },
] as const
/** Tia quét chạy qua nhãn được quét: từ trên mép nhãn xuống dưới mép, 22,9 đơn vị. */
const BEAM = { from: PROJECT(0.3, 1.85, 0.56), to: PROJECT(0.74, 1.85, 0.56), travel: 22.9 }
/** Thẻ yêu cầu giao bên phải; tên thẻ cỡ 13,5 cách mép trái 16. */
const CARD = { x: 212, y: 36, width: 178, height: 148 }
const TITLE = { font: 13.5, inset: 16 }

/**
 * Dòng của tên thẻ. Chữ lớn hơn cỡ thiết kế (máy cảm ứng) mà ước lượng (0,56 em mỗi ký tự) không vừa thẻ: hai dòng, ngắt ở khoảng trắng
 * gần giữa nhất ("Delivery / requirement").
 */
function titleLines(title: string, font: number): string[] {
  const room = CARD.width - TITLE.inset * 2
  if (font <= TITLE.font || title.length * font * 0.56 <= room) return [title]
  const half = title.length / 2
  let cut = -1
  for (let at = title.indexOf(' '); at >= 0; at = title.indexOf(' ', at + 1)) {
    if (cut < 0 || Math.abs(at - half) < Math.abs(cut - half)) cut = at
  }
  return cut < 0 ? [title] : [title.slice(0, cut), title.slice(cut + 1)]
}
/**
 * Mốc (ms sau lúc cảnh vào): kiện nhô lên lần lượt, nhãn bật ra, thẻ hiện, tia quét chạy một lần (600 ms), dấu kiểm bật ra cạnh nhãn vừa quét
 * khi tia gần hết — cả cảnh xong trước 1,5 giây.
 */
const AT = { package: 40, packageStep: 70, label: 380, labelStep: 50, card: 300, row: 440, rowStep: 70, qrStep: 50, beam: 700, check: 1100 } as const

/**
 * Cảnh "Nhập kiện và yêu cầu giao": kiện đẳng cự xám ánh cyan, mỗi kiện một nhãn QR; thẻ yêu cầu giao có điểm đến (ghim), hạn giao (đồng
 * hồ) và các kiện của nó. Chuyển động bật: một tia quét chạy qua nhãn trước một lần rồi dấu kiểm bật ra; tắt: hình tĩnh, có dấu kiểm.
 * Máy cảm ứng (`SceneTextFloor`): tên thẻ lớn lên, không vừa một dòng thì xuống hai dòng và thẻ dài thêm một dòng.
 */
export function IntakeScene({ motion }: { motion: boolean }) {
  const t = useT()
  const title = t('landing.how.scene.requirement')
  const titleFont = useSceneFont(TITLE.font)
  const lines = titleLines(title, titleFont)
  const lineHeight = Math.round(titleFont * 1.25)
  // Tên thẻ hai dòng: đường kẻ, các hàng và đáy thẻ lùi xuống một dòng
  const shift = (lines.length - 1) * lineHeight
  const beam = { '--at': `${AT.beam}ms`, '--beam-travel': `${BEAM.travel}px` } as CSSProperties
  const [scanned] = LABELS.slice(-1)
  const corner = scanned ? PROJECT(scanned.to[0], scanned.at, scanned.to[1]).split(',').map(Number) : [0, 0]
  const rows = [
    { Icon: MapPin, bar: 104 },
    { Icon: Clock, bar: 70 },
  ]
  return (
    <svg viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`} preserveAspectRatio="xMidYMid meet" className="block size-full">
      <ellipse cx={102} cy={170} rx={96} ry={20} {...svgPiece(motion, 'lp-fade', 0, 'fill-n-100')} />
      {PACKAGES.map((box, order) => (
        <IsoBlock key={order} box={box} project={PROJECT} piece={svgPiece(motion, 'lp-lift', AT.package + order * AT.packageStep)} />
      ))}
      {LABELS.map((label, order) => (
        <IsoQr key={order} project={PROJECT} face={label.face} at={label.at} from={label.from} to={label.to} piece={svgPiece(motion, 'lp-pop', AT.label + order * AT.labelStep)} />
      ))}
      {motion ? (
        <polyline points={`${BEAM.from} ${BEAM.to}`} className="lp-beam reveal-piece stroke-cyan-400" strokeWidth={2.5} strokeLinecap="round" style={beam} />
      ) : null}
      <CheckBadge x={(corner[0] ?? 0) + 6} y={(corner[1] ?? 0) - 6} r={8} piece={svgPiece(motion, 'lp-pop', AT.check)} />

      <g {...svgPiece(motion, 'lp-lift', AT.card)}>
        <rect x={CARD.x} y={CARD.y} width={CARD.width} height={CARD.height + shift} rx={12} className="fill-bg stroke-border" strokeWidth={1} />
        <text x={CARD.x + TITLE.inset} y={CARD.y + 27} fontSize={titleFont} className="fill-ink-1 font-semibold">
          {lines.length === 1
            ? title
            : lines.map((line, index) => <tspan key={index} x={CARD.x + TITLE.inset} dy={index === 0 ? 0 : lineHeight}>{line}</tspan>)}
        </text>
        <line x1={CARD.x + 14} x2={CARD.x + CARD.width - 14} y1={CARD.y + 41 + shift} y2={CARD.y + 41 + shift} className="stroke-line-soft" strokeWidth={1} />
      </g>
      {rows.map(({ Icon, bar }, order) => {
        const y = CARD.y + 53 + shift + order * 28
        return (
          <g key={order}>
            <g {...svgPiece(motion, 'lp-pop', AT.row + order * AT.rowStep, 'text-primary')}>
              <Icon x={CARD.x + 14} y={y} width={18} height={18} strokeWidth={1.5} />
            </g>
            <rect x={CARD.x + 40} y={y + 5} width={bar} height={8} rx={4} {...svgPiece(motion, 'lp-fade', AT.row + order * AT.rowStep + 40, 'fill-n-200')} />
          </g>
        )
      })}
      <g {...svgPiece(motion, 'lp-pop', AT.row + 2 * AT.rowStep, 'text-primary')}>
        <Package x={CARD.x + 14} y={CARD.y + 113 + shift} width={18} height={18} strokeWidth={1.5} />
      </g>
      {[0, 1, 2].map((order) => (
        <FlatQr key={order} x={CARD.x + 40 + order * 24} y={CARD.y + 113 + shift} size={18} piece={svgPiece(motion, 'lp-pop', AT.row + 2 * AT.rowStep + (order + 1) * AT.qrStep)} />
      ))}
    </svg>
  )
}
