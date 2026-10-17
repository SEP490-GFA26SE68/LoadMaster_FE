import { useMemo } from 'react'
import { StopDot } from '@/components/StopChip'
import { boxFaces, containerShell, createProjector, fitViewBox, shellColors, sortByDepth, type IsoBox, type IsoFace } from '@/lib/isometric'
import { useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'

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

/**
 * Sơ đồ đẳng cự của thẻ "Xếp hàng 3D theo điểm giao": thùng xe chia bốn vùng theo điểm giao, vùng điểm 4 sát vách trước, vùng điểm 1
 * sát cửa sau (viền cyan). Hình trang trí bằng SVG (`lib/isometric`, không Three.js) — chữ của thẻ đã nói điều hình vẽ; hàng chú giải
 * dưới hình đọc từ trái sang phải đúng như hình.
 */
export function ZoneDiagram() {
  const t = useT()
  const { frame, faces, badges, door } = useMemo(() => {
    const frame = fitViewBox(BODY, SCALE, PAD)
    const project = createProjector(SCALE, frame.offsetX, frame.offsetY)
    const point = (x: number, y: number, z: number) => project(x, y, z).split(',').map(Number) as [number, number]
    const shell = containerShell(BODY, project, shellColors(), { skirtHeight: 0.2 })
    const cargo: IsoFace[] = ZONES.flatMap((zone, index) => zoneBoxes(zone, index)).flatMap((box) =>
      boxFaces(box, project, { topTint: 0.12 }),
    )
    const badges = ZONES.map((zone, index) => {
      const [cx, cy] = point((zone.from + zone.to) / 2, BODY.width / 2, index < 3 ? 2.15 : 1.55)
      return { stop: zone.stop, cx, cy }
    })
    const { length: l, width: w, height: h } = BODY
    const door = [project(l, 0, 0), project(l, w, 0), project(l, w, h), project(l, 0, h), project(l, 0, 0)].join(' ')
    return { frame, faces: sortByDepth([...shell, ...cargo]), badges, door }
  }, [])

  return (
    <div aria-hidden className="flex flex-col gap-4">
      <svg viewBox={frame.viewBox} className="mx-auto block h-auto w-full max-w-150">
        {faces.map((face, index) => (
          <polygon key={index} points={face.points} fill={face.fill} stroke={face.stroke} strokeWidth={face.strokeWidth} strokeLinejoin="round" />
        ))}
        <polyline points={door} fill="none" className="stroke-cyan-300" strokeWidth={2.5} strokeDasharray="7 5" strokeLinejoin="round" />
        {badges.map((badge) => (
          <g key={badge.stop}>
            <line x1={badge.cx} y1={badge.cy + 15} x2={badge.cx} y2={badge.cy + 34} className="stroke-sky-text-3" strokeWidth={1.5} />
            <circle cx={badge.cx} cy={badge.cy} r={16} fill={stopColor(badge.stop)} className="stroke-panel-dark" strokeWidth={3} />
            <text x={badge.cx} y={badge.cy} dy="0.36em" textAnchor="middle" fontSize={17} fill={stopForeground(badge.stop)}
              className="font-display font-bold">{badge.stop}</text>
          </g>
        ))}
      </svg>
      <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-2 p-0">
        {ZONES.map((zone) => (
          <li key={zone.stop} className="flex items-center gap-2 text-small font-medium text-sky-text-2 pointer-coarse:text-body-lg">
            <StopDot stop={zone.stop} className="size-6 text-small" />
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
