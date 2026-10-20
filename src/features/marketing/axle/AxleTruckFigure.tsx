import type { CSSProperties } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { cargoLengthCm, type AxleDemoResult, type AxleDemoTruck } from './axle-demo'

/**
 * Xe mẫu nhìn ngang theo đúng số của seed (đơn vị khung hình là cm): lòng thùng từ vách trước (x = 0) tới cửa sau, trục trước dưới cabin
 * và trục sau ở đúng `positionXCm` đã khai, khối hàng dài một phần ba thùng đặt theo trọng tâm người xem chọn, đường thả từ trọng tâm xuống
 * mặt đường. Trục vượt giới hạn có vòng `--danger` quanh bánh — chữ "Vượt …" nằm ở bảng số, hình chỉ là trang trí (`aria-hidden`).
 * Nét giống hình xe của dải nguyên tắc (`steps/truck-side.tsx`), nhưng vẽ theo tỷ lệ thật để bánh nằm đúng chỗ trục.
 */

const CAB_WIDTH = 200
const CAB_GAP = 14
const WALL = 6
const RAIL_TOP = 4
const RAIL_H = 26
const WHEEL_Y = 40
const WHEEL_R = 44
const GROUND = WHEEL_Y + WHEEL_R + 4

/** Chiều cao khối hàng (cm của hình): thấp nhất 60, cao dần theo khối lượng tới sát nóc thùng — gợi ý, không phải số đo. */
function cargoHeight(truck: AxleDemoTruck, totalKg: number): number {
  return 60 + (truck.innerHeightCm - 80) * Math.min(1, totalKg / truck.maxPayloadKg)
}

/** Lưới thùng carton trên mặt khối hàng: cột 80 cm, hàng chia đều khoảng 60 cm. */
function cartonLines(width: number, height: number): string {
  const columns = Math.max(1, Math.round(width / 80))
  const rows = Math.max(1, Math.round(height / 60))
  const vertical = Array.from({ length: columns - 1 }, (_, i) => `M${((i + 1) * width) / columns} ${-height}V0`)
  const horizontal = Array.from({ length: rows - 1 }, (_, i) => `M0 ${(-(i + 1) * height) / rows}H${width}`)
  return [...vertical, ...horizontal].join('')
}

export function AxleTruckFigure({ truck, centerXCm, totalKg, result }: {
  truck: AxleDemoTruck
  centerXCm: number
  totalKg: number
  result: AxleDemoResult
}) {
  const t = useT()
  const length = truck.innerLengthCm
  const height = truck.innerHeightCm
  const cabRight = -CAB_GAP - WALL
  const cabLeft = cabRight - CAB_WIDTH
  const cabTop = -height + 45
  const minX = cabLeft - 40
  const width = length + WALL + 50 - minX
  const top = -height - WALL - 24
  const pct = (x: number) => `${(((x - minX) / width) * 100).toFixed(3)}%`

  const block = cargoLengthCm(truck)
  const tall = cargoHeight(truck, totalKg)
  const cab = `M${cabLeft} ${RAIL_TOP} V${cabTop + 105} Q${cabLeft} ${cabTop + 75} ${cabLeft + 25} ${cabTop + 62} L${cabLeft + 80} ${cabTop + 6} Q${cabLeft + 87} ${cabTop} ${cabLeft + 100} ${cabTop} H${cabRight} V${RAIL_TOP} Z`
  const glass = `M${cabLeft + 40} ${cabTop + 93} L${cabLeft + 93} ${cabTop + 28} H${cabRight - 25} V${cabTop + 93} Z`
  const wheels = [result.front, result.rear]
  const slide = { transform: `translate(${centerXCm - block / 2}px, 0px)` } as CSSProperties
  // Lần vào thùng lúc mục hiện ra: khối hàng bắt đầu ngay sau cửa sau
  const entry = { '--load-x': `${length + WALL - (centerXCm - block / 2)}px` } as CSSProperties
  const label = 'absolute text-small font-medium text-ink-2 pointer-coarse:text-body-lg'

  return (
    <div aria-hidden className="relative pt-7 pb-8 pointer-coarse:pt-8 pointer-coarse:pb-9">
      <span className={cn(label, 'top-0 whitespace-nowrap')} style={{ left: pct(0) }}>{t('landingAxle.figure.frontWall')}</span>
      <span className={cn(label, 'top-0 -translate-x-full whitespace-nowrap')} style={{ left: pct(length) }}>{t('landingAxle.figure.door')}</span>
      <svg viewBox={`${minX} ${top} ${width} ${GROUND + 6 - top}`} className="block h-auto w-full">
        <line x1={minX} x2={minX + width} y1={GROUND} y2={GROUND} className="stroke-n-200" strokeWidth={4} strokeLinecap="round" />
        <rect x={cabLeft + 12} y={RAIL_TOP} width={length + WALL + 10 - cabLeft - 12} height={RAIL_H} rx={6} className="fill-n-700" />
        <path d={cab} className="fill-n-700" />
        <path d={glass} className="fill-cyan-100" />
        {/* Thùng: vách dày 6 cm, lòng thùng nền cyan nhạt, cửa sau là nét đậm bên phải */}
        <rect x={-WALL} y={-height - WALL} width={length + 2 * WALL} height={height + WALL + RAIL_TOP} rx={8} className="fill-bg stroke-n-400" strokeWidth={4} />
        <rect x={0} y={-height} width={length} height={height} className="fill-cyan-50" />
        <line x1={length + WALL} x2={length + WALL} y1={-height - WALL} y2={RAIL_TOP} className="stroke-n-600" strokeWidth={8} strokeLinecap="round" />
        {wheels.map((axle) => (
          <g key={axle.group} data-axle={axle.group} data-over={axle.overKg === null ? undefined : ''}>
            {axle.overKg === null ? null : <circle cx={axle.positionXCm} cy={WHEEL_Y} r={WHEEL_R + 9} className="fill-none stroke-danger" strokeWidth={8} />}
            <circle cx={axle.positionXCm} cy={WHEEL_Y} r={WHEEL_R} className="fill-n-800 stroke-surface" strokeWidth={6} />
            <circle cx={axle.positionXCm} cy={WHEEL_Y} r={16} className="fill-n-300" />
          </g>
        ))}
        <g className="ax-drop" style={entry}>
          <g className="ax-slide" style={slide} data-cargo>
            <rect x={0} y={-tall} width={block} height={tall} rx={4} className="fill-cyan-300 stroke-cyan-700" strokeWidth={4} />
            <path d={cartonLines(block, tall)} className="fill-none stroke-cyan-600" strokeWidth={3} />
            <line x1={block / 2} x2={block / 2} y1={-tall / 2} y2={GROUND - 14} className="stroke-ink-strong" strokeWidth={4} strokeDasharray="12 10" />
            <path d={`M${block / 2 - 16} ${GROUND - 26}h32l-16 24z`} className="fill-ink-strong" />
            <circle cx={block / 2} cy={-tall / 2} r={20} className="fill-bg stroke-ink-strong" strokeWidth={4} />
            <path d={`M${block / 2} ${-tall / 2}v-20a20 20 0 0 1 20 20zM${block / 2} ${-tall / 2}v20a20 20 0 0 1 -20 -20z`} className="fill-ink-strong" />
          </g>
        </g>
      </svg>
      <span className={cn(label, 'ax-follow bottom-0 -translate-x-1/2 whitespace-nowrap font-semibold text-ink-strong')} style={{ left: pct(centerXCm) }}>
        {t('landingAxle.figure.center')}
      </span>
    </div>
  )
}
