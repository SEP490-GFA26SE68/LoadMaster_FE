import { stopColor, stopForeground } from '@/lib/stops'
import { projectToSketch, routeExtent, routeLine, type RouteMapData, type SketchPoint } from './route-map-model'

const SIZE = { width: 640, height: 320, padding: 36 } as const
const RADIUS = 13

/**
 * Sơ đồ tuyến SVG thay bản đồ khi không có WebGL (jsdom, trình duyệt tắt WebGL) và lúc đang tải chunk bản đồ — như
 * `VehiclePreview` làm với khung 3D (AGENTS mục 7): cùng dữ liệu, cùng hình mốc (kho ô vuông, điểm giao hình tròn màu điểm giao kèm
 * số, xe vòng viền), đúng vị trí tương đối theo toạ độ, không nền địa lý. Chỉ là hình: tên điểm nằm ở danh sách `sr-only` của `RouteMap`.
 */
export function RouteMapSketch({ data }: { data: RouteMapData }) {
  const extent = routeExtent(data)
  const project = (points: Parameters<typeof projectToSketch>[0]) => projectToSketch(points, SIZE, extent)
  const line = project(routeLine(data))
  const stops = project(data.stops)
  const [depot] = data.depot ? project([data.depot]) : []
  const [vehicle] = data.vehicle ? project([data.vehicle]) : []
  const others = project(data.others ?? [])
  const at = (point: SketchPoint) => `translate(${point.x.toFixed(1)} ${point.y.toFixed(1)})`

  return (
    <svg
      aria-hidden
      data-route-sketch
      viewBox={`0 0 ${SIZE.width} ${SIZE.height}`}
      preserveAspectRatio="xMidYMid meet"
      className="block size-full"
    >
      {line.length > 1 ? (
        <polyline
          data-route-line
          points={line.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ')}
          fill="none"
          stroke="var(--primary)"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {depot ? (
        <g data-marker="depot" transform={at(depot)}>
          <rect x={-RADIUS} y={-RADIUS} width={RADIUS * 2} height={RADIUS * 2} rx={6} fill="var(--ink-strong)" stroke="var(--bg)" strokeWidth={2} />
          {/* mái và thân kho, vẽ tay để không cần icon HTML trong SVG */}
          <path d="M-6 -1 L0 -5.5 L6 -1 V6 H-6 Z" fill="none" stroke="var(--bg)" strokeWidth={1.5} strokeLinejoin="round" />
        </g>
      ) : null}
      {data.stops.map((stop, index) => {
        const point = stops[index]
        if (!point) return null
        return (
          <g key={stop.id} data-marker="stop" transform={at(point)}>
            <circle r={RADIUS} fill={stopColor(stop.number)} stroke="var(--bg)" strokeWidth={2} />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fill={stopForeground(stop.number)}
              className="font-mono text-caption font-semibold tabular-nums"
            >
              {stop.number}
            </text>
          </g>
        )
      })}
      {(data.others ?? []).map((other, index) => {
        const point = others[index]
        if (!point) return null
        return (
          <g key={other.id} data-marker="other-vehicle" transform={at(point)}>
            <circle r={RADIUS - 2} fill="var(--bg)" stroke="var(--n-500)" strokeWidth={2} />
            <circle r={3.5} fill="var(--n-500)" />
            {other.tag ? <VehicleTag text={other.tag} offset={RADIUS + 10} /> : null}
          </g>
        )
      })}
      {vehicle ? (
        <g data-marker="vehicle" transform={at(vehicle)}>
          <circle r={RADIUS + 1} fill="var(--bg)" stroke="var(--primary)" strokeWidth={2} />
          <circle r={4.5} fill="var(--primary)" />
          {data.vehicle?.tag ? <VehicleTag text={data.vehicle.tag} offset={RADIUS + 13} /> : null}
        </g>
      ) : null}
    </svg>
  )
}

/** Nhãn ngắn dưới mốc xe (mã chuyến, nguồn vị trí), viền nền để đọc được khi đè lên đường tuyến. */
function VehicleTag({ text, offset }: { text: string; offset: number }) {
  return (
    <text y={offset} textAnchor="middle" fill="var(--ink-1)" stroke="var(--bg)" strokeWidth={3} paintOrder="stroke" className="text-micro font-medium">
      {text}
    </text>
  )
}
