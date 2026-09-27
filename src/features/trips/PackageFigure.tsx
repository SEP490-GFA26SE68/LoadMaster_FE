import { useMemo } from 'react'
import { useFormat, useT } from '@/lib/i18n'
import { stopColor } from '@/lib/stops'
import { FIGURE_HEIGHT, FIGURE_WIDTH, packageFigure, type Point } from './package-figure'

const AXIS_KEY = { length: 'lengthShort', width: 'widthShort', height: 'heightShort' } as const

/**
 * Hình đẳng cự 146 × 120 của một kiện ở đầu panel kiện (V2.3): màu điểm giao, đường kích thước "D 60 · R 50 · C 50". SVG thuần qua
 * `lib/isometric.ts` — ảnh tĩnh không xoay được thì không dùng Three.js (AGENTS mục 7).
 */
export function PackageFigure({ lengthCm, widthCm, heightCm, deliveryStop }: {
  lengthCm: number
  widthCm: number
  heightCm: number
  deliveryStop: number
}) {
  const t = useT()
  const format = useFormat()
  const figure = useMemo(
    () => packageFigure({ lengthCm, widthCm, heightCm }, stopColor(deliveryStop)),
    [lengthCm, widthCm, heightCm, deliveryStop],
  )
  const size = format.dimensions(lengthCm, widthCm, heightCm)
  const line = (a: Point, b: Point) => ({ x1: a.x, y1: a.y, x2: b.x, y2: b.y })

  return (
    <svg
      width={FIGURE_WIDTH}
      height={FIGURE_HEIGHT}
      viewBox={`0 0 ${FIGURE_WIDTH} ${FIGURE_HEIGHT}`}
      role="img"
      aria-label={t('trips.packages.preview.label', { size })}
      className="block flex-none"
    >
      <polygon points={figure.shadow} fill="var(--n-900)" fillOpacity={0.07} />
      {figure.faces.map((face, index) => (
        <polygon key={index} points={face.points} fill={face.fill} stroke={face.stroke} strokeWidth={face.strokeWidth} strokeLinejoin="round" />
      ))}
      <line {...line(...figure.tape)} stroke="rgba(0,0,0,.14)" strokeWidth={0.8} />
      {figure.dimensions.map((dim) => (
        <g key={dim.axis}>
          {dim.extensions.map(([from, to], index) => (
            <line key={index} {...line(from, to)} className="stroke-n-400" strokeWidth={0.8} strokeDasharray="2 2" />
          ))}
          <line {...line(dim.from, dim.to)} className="stroke-n-600" strokeWidth={1} />
          <circle cx={dim.from.x} cy={dim.from.y} r={1.6} className="fill-n-600" />
          <circle cx={dim.to.x} cy={dim.to.y} r={1.6} className="fill-n-600" />
          <text x={dim.label.x} y={dim.label.y} textAnchor={dim.anchor} className="fill-ink-2 font-display text-micro font-semibold tabular-nums">
            {t(`trips.packages.preview.${AXIS_KEY[dim.axis]}`)} {format.lengthValue(dim.valueCm)}
          </text>
        </g>
      ))}
    </svg>
  )
}
