import { useMemo, type CSSProperties } from 'react'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { TryBox } from './try-request'
import { containerSize, tryPicture } from './try-preview'

/** Cả lượt kiện rơi vào không quá chừng này (ms), ít kiện thì mỗi kiện cách nhau tối đa 30 ms. */
const DROP_SPAN_MS = 1400
const DROP_GAP_MAX_MS = 30

/**
 * Hình đẳng cự nền tối của lòng thùng và các kiện đã xếp (SVG, không Three.js). Chưa có kết quả thì chỉ vẽ lòng thùng theo số đang nhập.
 * Hình là `role="img"` có tên nói kích thước và số kiện; số đầy đủ nằm ở phần kết quả bên dưới.
 */
export function TryPreview({ lengthCm, widthCm, heightCm, boxes, className }: {
  lengthCm: number
  widthCm: number
  heightCm: number
  boxes?: readonly TryBox[]
  className?: string
}) {
  const t = useT()
  const format = useFormat()
  const picture = useMemo(
    () => tryPicture(containerSize(lengthCm, widthCm, heightCm), boxes ?? []),
    [lengthCm, widthCm, heightCm, boxes],
  )
  const size = format.dimensions(lengthCm, widthCm, heightCm)
  const label = boxes
    ? t('landingTry.result.previewLabel', { size, placed: format.integer(boxes.length) })
    : t('landingTry.result.emptyPreviewLabel', { size })
  const gap = Math.min(DROP_GAP_MAX_MS, DROP_SPAN_MS / Math.max(1, picture.boxes.length))
  return (
    <div className={cn('relative grid min-h-0 place-items-center overflow-hidden rounded-md bg-canvas-1 p-2', className)}>
      <svg
        viewBox={picture.viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full max-h-full w-full"
        role="img"
        aria-label={label}
      >
        {picture.back.map((face, index) => (
          <polygon key={index} points={face.points} fill={face.fill} stroke={face.stroke} strokeWidth={face.strokeWidth} strokeLinejoin="round" />
        ))}
        <g style={{ '--try-gap': `${gap.toFixed(2)}ms` } as CSSProperties}>
          {picture.boxes.map((box) => (
            <g key={box.key} className={cn('try-drop', `try-kind-${box.kind}`)} style={{ '--try-step': box.step } as CSSProperties}>
              {box.faces.map((face) => (
                <polygon key={face.kind} points={face.points} className={cn('try-face', `try-face-${face.kind}`)} />
              ))}
            </g>
          ))}
        </g>
        {picture.front.map((face, index) => (
          <polygon key={index} points={face.points} fill={face.fill} stroke={face.stroke} strokeWidth={face.strokeWidth} strokeLinejoin="round" />
        ))}
        <polyline points={picture.roof} className="try-roof" />
      </svg>
    </div>
  )
}
