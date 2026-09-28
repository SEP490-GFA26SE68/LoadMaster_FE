import { useMemo } from 'react'
import type { OptimizationRequest, PackagePlacement } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import {
  boxFaces,
  containerShell,
  createProjector,
  fitViewBox,
  roofOutline,
  shellColors,
  sortByDepth,
} from '@/lib/isometric'
import { cn } from '@/lib/utils'
import { revisionThumbnail } from './revision-thumbnail'

const SCALE = 21
const PAD = 12

/**
 * Ảnh thu nhỏ SVG đẳng cự nền tối của một revision, dựng từ placement thật (LM-051). Không dùng Three.js: ảnh tĩnh,
 * không xoay (AGENTS.md mục 7). Khung nhìn tính từ lòng thùng của chính revision nên xe nào cũng vừa khung.
 */
export function PlanThumbnail({
  revisionId,
  request,
  placements,
  totalCount,
  className,
}: {
  revisionId: string
  request: Pick<OptimizationRequest, 'vehicle' | 'packages'>
  placements: readonly PackagePlacement[]
  totalCount: number
  /** Chiều cao khung (mặc định 190 px). V2.3: 176 px trong ma trận so sánh, 150 px ở thẻ bản lưu (LM-106). */
  className?: string
}) {
  const t = useT()
  const format = useFormat()

  const { frame, faces, roof, drawnCount, placedCount } = useMemo(() => {
    const thumbnail = revisionThumbnail(request, placements)
    const frame = fitViewBox(thumbnail.container, SCALE, PAD)
    const project = createProjector(SCALE, frame.offsetX, frame.offsetY)
    const cargo = thumbnail.boxes.flatMap((box) => boxFaces(box, project, { strokeWidth: 0.5, topTint: 0.08 }))
    return {
      frame,
      faces: sortByDepth([...containerShell(thumbnail.container, project, shellColors()), ...cargo]),
      roof: roofOutline(thumbnail.container, project),
      drawnCount: thumbnail.boxes.length,
      placedCount: thumbnail.placedCount,
    }
  }, [request, placements])

  return (
    <div className={cn('relative h-[190px] flex-none bg-canvas-1', className)}>
      <svg
        viewBox={frame.viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="block h-full w-full"
        role="img"
        aria-label={t('trips.compare.thumbnail', {
          id: revisionId,
          placed: format.integer(placedCount),
          total: format.integer(totalCount),
        })}
      >
        {faces.map((face, index) => (
          <polygon
            key={index}
            points={face.points}
            fill={face.fill}
            stroke={face.stroke}
            strokeWidth={face.strokeWidth}
            strokeLinejoin="round"
          />
        ))}
        <polyline points={roof} fill="none" stroke="rgba(255,255,255,.28)" strokeWidth={0.8} strokeDasharray="2 2" />
      </svg>
      <span className="absolute top-2.5 right-3 rounded-sm bg-black/35 px-1.5 py-0.5 font-mono text-[11px] leading-3.5 text-white/80">
        {format.integer(placedCount)} / {format.integer(totalCount)}
      </span>
      {drawnCount < placedCount ? (
        <span className="absolute bottom-2.5 left-3 text-[11px] leading-3.5 text-white/65">
          {t('trips.compare.thumbnailCapped', { drawn: format.integer(drawnCount), placed: format.integer(placedCount) })}
        </span>
      ) : null}
    </div>
  )
}
