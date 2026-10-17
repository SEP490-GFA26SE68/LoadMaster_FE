import { useId, useMemo } from 'react'
import { containerShell, createProjector, fitViewBox, groundShadow, roofOutline, shellColors, sortByDepth } from '@/lib/isometric'
import { cn } from '@/lib/utils'
import { LANDING_REQUEST } from './landing-sample.mock'

const SCALE = 60
const PAD = 40
const METERS_PER_CM = 0.01

/**
 * Ảnh tĩnh của khung 3D trên trang giới thiệu trong lúc trình duyệt tải bộ máy 3D và tính chuyến mẫu: thùng rỗng của chuyến mẫu, vẽ
 * đẳng cự bằng `lib/isometric` (SVG, không Three.js) để lần vẽ đầu có hình ngay. Trang trí — chữ của khung đã nói khung là gì.
 */
export function LandingStagePoster({ className }: { className?: string }) {
  const svgId = `lm-stage-${useId().replace(/[^\w-]/g, '')}`
  const { frame, faces, roof, shadow } = useMemo(() => {
    const { innerLengthCm, innerWidthCm, innerHeightCm } = LANDING_REQUEST.vehicle
    const size = { length: innerLengthCm * METERS_PER_CM, width: innerWidthCm * METERS_PER_CM, height: innerHeightCm * METERS_PER_CM }
    const frame = fitViewBox(size, SCALE, PAD)
    const project = createProjector(SCALE, frame.offsetX, frame.offsetY)
    return {
      frame,
      faces: sortByDepth(containerShell(size, project, shellColors())),
      roof: roofOutline(size, project),
      shadow: groundShadow(size, project),
    }
  }, [])

  return (
    <svg aria-hidden viewBox={frame.viewBox} preserveAspectRatio="xMidYMid meet" className={cn('block size-full p-6 sm:p-10', className)}>
      <defs>
        <filter id={`${svgId}-blur`} x="-30%" y="-60%" width="160%" height="240%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
      </defs>
      <polygon points={shadow} className="fill-canvas-2" opacity={0.8} filter={`url(#${svgId}-blur)`} />
      {faces.map((face, index) => (
        <polygon key={index} points={face.points} fill={face.fill} stroke={face.stroke} strokeWidth={face.strokeWidth} strokeLinejoin="round" />
      ))}
      <polyline points={roof} fill="none" className="stroke-landing-stage-border" strokeWidth={1.2} strokeDasharray="4 4" />
    </svg>
  )
}
