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
import { revisionThumbnail, type RevisionThumbnail } from './revision-thumbnail'

const SCALE = 21
const PAD = 12

/**
 * Ảnh thu nhỏ SVG đẳng cự nền tối của một phương án, dựng từ placement thật (LM-051). Không dùng Three.js: ảnh tĩnh,
 * không xoay (AGENTS.md mục 7). Khung nhìn tính từ lòng thùng của chính phương án nên xe nào cũng vừa khung. Dùng ở màn So sánh
 * phương án và ở bộ chọn A · B · C của khung 3D trang giới thiệu.
 */
export function PlanThumbnail({
  revisionId,
  request,
  placements,
  totalCount,
  overlays = true,
  className,
}: {
  revisionId: string
  request: Pick<OptimizationRequest, 'vehicle' | 'packages'>
  placements: readonly PackagePlacement[]
  totalCount: number
  /** `false`: không có nhãn số kiện và nhãn "đã vẽ n khối" đè trên ảnh — ảnh nhỏ mà số đã nằm ngay cạnh. */
  overlays?: boolean
  /** Chiều cao khung (mặc định 190 px). V2.3: 176 px trong ma trận so sánh, 150 px ở thẻ bản lưu (LM-106). */
  className?: string
}) {
  const t = useT()
  const format = useFormat()
  const thumbnail = useMemo(() => revisionThumbnail(request, placements), [request, placements])
  const label = t('trips.compare.thumbnail', {
    id: revisionId,
    placed: format.integer(thumbnail.placedCount),
    total: format.integer(totalCount),
  })
  return <ThumbnailFrame thumbnail={thumbnail} label={label} totalCount={totalCount} overlays={overlays} className={className} />
}

/**
 * Khung vẽ của ảnh thu nhỏ từ một `RevisionThumbnail` đã dựng — chung cho revision của kho mẫu (`PlanThumbnail`) và phương án của máy
 * chủ (`server-plan-thumbnail.ts`). `label` là tên truy cập của hình.
 */
export function ThumbnailFrame({ thumbnail, label, totalCount, overlays = true, className }: {
  thumbnail: RevisionThumbnail
  label: string
  totalCount: number
  overlays?: boolean
  className?: string
}) {
  const t = useT()
  const format = useFormat()

  const { frame, faces, roof } = useMemo(() => {
    const frame = fitViewBox(thumbnail.container, SCALE, PAD)
    const project = createProjector(SCALE, frame.offsetX, frame.offsetY)
    const cargo = thumbnail.boxes.flatMap((box) => boxFaces(box, project, { strokeWidth: 0.5, topTint: 0.08 }))
    return {
      frame,
      faces: sortByDepth([...containerShell(thumbnail.container, project, shellColors()), ...cargo]),
      roof: roofOutline(thumbnail.container, project),
    }
  }, [thumbnail])
  const drawnCount = thumbnail.boxes.length
  const { placedCount } = thumbnail

  return (
    <div className={cn('relative h-[190px] flex-none bg-canvas-1', className)}>
      <svg viewBox={frame.viewBox} preserveAspectRatio="xMidYMid meet" className="block h-full w-full" role="img" aria-label={label}>
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
      {overlays ? (
        <span className="absolute top-2.5 right-3 rounded-sm bg-black/35 px-1.5 py-0.5 font-mono text-[11px] leading-3.5 text-white/80">
          {format.integer(placedCount)} / {format.integer(totalCount)}
        </span>
      ) : null}
      {overlays && drawnCount < placedCount ? (
        <span className="absolute bottom-2.5 left-3 text-[11px] leading-3.5 text-white/65">
          {t('trips.compare.thumbnailCapped', { drawn: format.integer(drawnCount), placed: format.integer(placedCount) })}
        </span>
      ) : null}
    </div>
  )
}
