import { useMemo } from 'react'
import type { ScenePlacement } from '@/features/viewer3d/scene-input'
import { useT } from '@/lib/i18n'
import { boxFaces, createProjector } from '@/lib/isometric'
import { stopColor } from '@/lib/stops'
import { orientationHint } from './describe-step'

const SCALE = 34
/** 1 m thật = 4 đơn vị hình để kiện 40 cm hiện to rõ… */
const UNITS_PER_CM = 4 / 100
/** …nhưng cạnh dài nhất không quá 3 đơn vị để kiện dựng đứng vẫn nằm trong khung. */
const MAX_EDGE_UNITS = 3
const ARROW_UNITS = 0.9

type Point = [number, number, number]

/**
 * Hình minh hoạ hướng đặt theo mã Spec (LM-060): kiện đúng tỉ lệ kích thước đã xoay, mũi tên đen trên sàn chỉ ra cửa sau,
 * mũi tên xanh mọc từ mặt trên gốc của kiện — lên trên với LWH/WLH, sang vách bên với LHW/WHL, dọc thùng với HLW/HWL.
 * Ba mặt thấy được của phép chiếu là +X, +Y và mặt trên, nên mũi tên luôn mọc từ một mặt nhìn thấy.
 */
export function OrientationFigure({ placement }: { placement: ScenePlacement }) {
  const t = useT()
  const figure = useMemo(() => {
    const project = createProjector(SCALE)
    const k = Math.min(UNITS_PER_CM, MAX_EDGE_UNITS / Math.max(placement.lengthCm, placement.widthCm, placement.heightCm))
    const l = placement.lengthCm * k
    const w = placement.widthCm * k
    const h = placement.heightCm * k
    const color = stopColor(placement.stop)
    const at = (point: Point) => project(...point)

    const floor = [at([-0.6, -0.6, 0]), at([l + 1.6, -0.6, 0]), at([l + 1.6, w + 0.6, 0]), at([-0.6, w + 0.6, 0])].join(' ')
    const faces = boxFaces({ x: 0, y: 0, z: 0, length: l, width: w, height: h, color }, project, { stroke: 'rgba(0,0,0,.25)', strokeWidth: 0.8, topTint: 0.08 })
    const ax = l + 0.25
    const ay = w / 2
    const door = [at([ax, ay, 0.02]), at([ax + 1.1, ay, 0.02])].join(' ')
    const doorHead = [at([ax + 1.1, ay - 0.18, 0.02]), at([ax + 1.4, ay, 0.02]), at([ax + 1.1, ay + 0.18, 0.02])].join(' ')

    const axis = orientationHint(placement.orientation).heightAxis
    const start: Point = axis === 'z' ? [l / 2, w / 2, h] : axis === 'y' ? [l / 2, w, h / 2] : [l, w / 2, h / 2]
    const step = (distance: number): Point => {
      const [x, y, z] = start
      return axis === 'z' ? [x, y, z + distance] : axis === 'y' ? [x, y + distance, z] : [x + distance, y, z]
    }
    const tip = at(step(ARROW_UNITS))
    const [tipX = '0', tipY = '0'] = tip.split(',')

    return { floor, faces, door, doorHead, top: `${at(start)} ${tip}`, tipX, tipY }
  }, [placement])

  return (
    <svg
      width="260"
      height="150"
      viewBox="0 0 260 180"
      className="block flex-none"
      role="img"
      aria-label={t('warehouse.figure.label', { code: placement.orientation })}
    >
      <g transform="translate(110,112)">
        <polygon points={figure.floor} fill="var(--surface)" stroke="var(--border)" strokeWidth={1} />
        {figure.faces.map((face, index) => (
          <polygon key={index} points={face.points} fill={face.fill} stroke={face.stroke} strokeWidth={face.strokeWidth} strokeLinejoin="round" />
        ))}
        <polyline points={figure.door} fill="none" stroke="var(--text)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        <polygon points={figure.doorHead} fill="var(--text)" />
        <polyline points={figure.top} fill="none" stroke="var(--primary)" strokeWidth={3} strokeLinecap="round" />
        <circle cx={figure.tipX} cy={figure.tipY} r={5} fill="var(--primary)" />
      </g>
      <text x="236" y="170" textAnchor="end" fontFamily="var(--font-sans)" fontSize="20" fontWeight="600" fill="var(--text)">
        {t('warehouse.figure.door')}
      </text>
      <text x="8" y="26" fontFamily="var(--font-sans)" fontSize="20" fill="var(--text-3)">
        {t('warehouse.figure.front')}
      </text>
      <text x="252" y="26" textAnchor="end" fontFamily="var(--font-mono)" fontSize="22" fontWeight="600" fill="var(--text)">
        {placement.orientation}
      </text>
    </svg>
  )
}
