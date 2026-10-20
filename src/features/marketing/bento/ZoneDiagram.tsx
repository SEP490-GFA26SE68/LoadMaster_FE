import { useMemo } from 'react'
import { StopDot } from '@/components/StopChip'
import { boxFaces, containerShell, createProjector, fitViewBox, shellColors, sortByDepth, type IsoBox, type IsoFace } from '@/lib/isometric'
import { useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { useRevealMotion } from '../reveal'
import { svgPiece } from './FeatureVisuals'

/** Thùng 6 × 2,4 × 2,5 m như chuyến mẫu của phần mở đầu; đơn vị mét như `lib/isometric`. */
const BODY = { length: 6, width: 2.4, height: 2.5 }
const SCALE = 60
const PAD = 26
/** Vùng theo thứ tự từ vách trước (sâu nhất, điểm 4) ra cửa sau (điểm 1); giữa hai vùng có khoảng đệm như phương án thật. */
const ZONES = [
  { stop: 4, from: 0, to: 1.6 },
  { stop: 3, from: 1.7, to: 3.1 },
  { stop: 2, from: 3.2, to: 4.7 },
  { stop: 1, from: 4.8, to: 6 },
] as const
const COLUMN = 0.48
const ROWS = [0.03, 0.82, 1.61] as const
const ROW_WIDTH = 0.76
/** Mốc (ms sau lúc ô bắt đầu): vùng hiện dần theo thứ tự xếp — điểm cuối trước — cách nhau 120 ms; số điểm bật ra sau vùng của nó. */
const ZONE_AT = 200
const ZONE_STEP = 120
const BADGE_LAG = 150
const DOOR_AT = 700

/** Khối hàng của một vùng: các cột hai lớp, lớp trên thấp dần ra phía cửa để nhìn thấy vùng sau. */
function zoneBoxes(zone: (typeof ZONES)[number], zoneIndex: number): IsoBox[] {
  const boxes: IsoBox[] = []
  const color = stopColor(zone.stop)
  for (let x = zone.from + 0.02, column = 0; x + COLUMN <= zone.to + 0.001; x += COLUMN + 0.04, column += 1) {
    ROWS.forEach((y, row) => {
      const base = 0.86 + ((column + row) % 2) * 0.08
      boxes.push({ x, y, z: 0, length: COLUMN, width: ROW_WIDTH, height: base, color })
      if (zoneIndex < 3 || row === 0) {
        boxes.push({ x, y, z: base + 0.02, length: COLUMN, width: ROW_WIDTH, height: 0.62 + ((column + row + 1) % 2) * 0.1, color })
      }
    })
  }
  return boxes
}

const shape = (face: IsoFace, key: number) => (
  <polygon key={key} points={face.points} fill={face.fill} stroke={face.stroke} strokeWidth={face.strokeWidth} strokeLinejoin="round" />
)

/**
 * Sơ đồ đẳng cự của thẻ "Xếp hàng 3D theo điểm giao": thùng xe chia bốn vùng theo điểm giao, vùng điểm 4 sát vách trước, vùng điểm 1
 * sát cửa sau (viền cyan). Hình trang trí bằng SVG (`lib/isometric`, không Three.js) — chữ của thẻ đã nói điều hình vẽ; hàng chú giải
 * dưới hình đọc từ trái sang phải đúng như hình. Các vùng cách nhau theo chiều dài thùng nên vẽ vùng sâu trước, mỗi vùng theo chiều sâu
 * riêng, là đúng thứ tự che khuất — mỗi vùng một nhóm, hiện dần và nhô lên 8 px khi ô hiện ra.
 */
export function ZoneDiagram() {
  const t = useT()
  const motion = useRevealMotion()
  const { frame, back, zones, front, door } = useMemo(() => {
    const frame = fitViewBox(BODY, SCALE, PAD)
    const project = createProjector(SCALE, frame.offsetX, frame.offsetY)
    const point = (x: number, y: number, z: number) => project(x, y, z).split(',').map(Number) as [number, number]
    const shell = sortByDepth(containerShell(BODY, project, shellColors(), { skirtHeight: 0.2 }))
    const zones = ZONES.map((zone, index) => {
      const [cx, cy] = point((zone.from + zone.to) / 2, BODY.width / 2, index < 3 ? 2.15 : 1.55)
      const faces = sortByDepth(zoneBoxes(zone, index).flatMap((box) => boxFaces(box, project, { topTint: 0.12 })))
      return { stop: zone.stop, faces, cx, cy }
    })
    const { length: l, width: w, height: h } = BODY
    const door = [project(l, 0, 0), project(l, w, 0), project(l, w, h), project(l, 0, h), project(l, 0, 0)].join(' ')
    return { frame, back: shell.filter((face) => face.depth < 0), zones, front: shell.filter((face) => face.depth >= 0), door }
  }, [])

  return (
    <div aria-hidden className="flex flex-col gap-4">
      <svg viewBox={frame.viewBox} className="mx-auto block h-auto w-full max-w-150">
        {back.map(shape)}
        {zones.map((zone, order) => (
          <g key={zone.stop} {...svgPiece(motion, 'lp-lift', ZONE_AT + order * ZONE_STEP)}>{zone.faces.map(shape)}</g>
        ))}
        {front.map(shape)}
        <polyline points={door} fill="none" strokeWidth={2.5} strokeDasharray="7 5" strokeLinejoin="round" {...svgPiece(motion, 'lp-fade', DOOR_AT, 'stroke-cyan-300')} />
        {zones.map(({ stop, cx, cy }, order) => (
          <g key={stop} {...svgPiece(motion, 'lp-pop', ZONE_AT + order * ZONE_STEP + BADGE_LAG)}>
            <line x1={cx} y1={cy + 15} x2={cx} y2={cy + 34} className="stroke-sky-text-3" strokeWidth={1.5} />
            <circle cx={cx} cy={cy} r={16} fill={stopColor(stop)} className="stroke-panel-dark" strokeWidth={3} />
            <text x={cx} y={cy} dy="0.36em" textAnchor="middle" fontSize={17} fill={stopForeground(stop)} className="font-display font-bold">{stop}</text>
          </g>
        ))}
      </svg>
      <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-2 p-0">
        {ZONES.map((zone) => (
          <li key={zone.stop} className="flex items-center gap-2 text-small font-medium text-sky-text-2 pointer-coarse:text-body-lg">
            <StopDot stop={zone.stop} className="size-6 text-small pointer-coarse:size-7 pointer-coarse:text-body-lg" />
            {t('landing.features.zones.zone', { number: zone.stop })}
          </li>
        ))}
        <li className="flex items-center gap-2 text-small font-semibold text-cyan-300 pointer-coarse:text-body-lg">
          <span className="h-5 w-1.5 rounded-sm border-2 border-dashed border-cyan-300" />
          {t('landing.features.zones.door')}
        </li>
      </ul>
    </div>
  )
}
