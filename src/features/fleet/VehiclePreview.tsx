import { lazy, Suspense, useEffect, useState } from 'react'
import { useWatch, type Control } from 'react-hook-form'
import { useT } from '@/lib/i18n'
import { EMPTY_PREVIEW, nextPreview, previewVehicle } from './vehicle-preview'
import type { VehicleFormValues } from './vehicle-form'
import { VehiclePreviewSkeleton } from './VehiclePreviewSkeleton'

const VehiclePreviewViewer = lazy(() =>
  import('@/features/viewer3d/VehiclePreviewViewer').then((m) => ({ default: m.VehiclePreviewViewer })),
)

/** Gõ liền tay không đẩy từng giá trị trung gian vào scene (LM-042). */
export const PREVIEW_DEBOUNCE_MS = 250

/** jsdom và trình duyệt tắt WebGL không có lớp này: khi đó không tải chunk Three.js, chỉ vẽ phác thảo SVG. */
const HAS_WEBGL = typeof WebGLRenderingContext !== 'undefined'

/**
 * Xem trước 3D ở form xe (LM-042): đọc form bằng `useWatch`, sau 250 ms không gõ mới kiểm phần hình học
 * (`previewVehicle`). Giá trị chưa hợp lệ thì giữ hình hợp lệ gần nhất và báo đang chờ.
 */
export function VehiclePreview({
  control,
  highlightedObstacleId,
  onHighlightObstacle,
}: {
  control: Control<VehicleFormValues>
  highlightedObstacleId: string | null
  onHighlightObstacle: (id: string | null) => void
}) {
  const t = useT()
  const values = useWatch({ control })
  const [preview, setPreview] = useState(() => nextPreview(EMPTY_PREVIEW, previewVehicle(values)))

  useEffect(() => {
    const timer = setTimeout(() => setPreview((state) => nextPreview(state, previewVehicle(values))), PREVIEW_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [values])

  const { vehicle, frame, pending } = preview
  return (
    <div className="flex flex-col gap-2">
      <div
        role="region"
        aria-label={t('fleet.preview.label')}
        className="relative h-80 overflow-hidden rounded-md border border-border-dark bg-canvas-1"
        data-preview-pending={pending}
      >
        {vehicle && frame && HAS_WEBGL ? (
          <Suspense
            fallback={
              <div role="status" aria-label={t('fleet.preview.loading')}>
                <VehiclePreviewSkeleton vehicle={vehicle} loading />
              </div>
            }
          >
            <VehiclePreviewViewer
              vehicle={vehicle}
              frameVehicle={frame}
              highlightedObstacleId={highlightedObstacleId}
              onObstacleSelect={onHighlightObstacle}
            />
          </Suspense>
        ) : (
          <VehiclePreviewSkeleton vehicle={vehicle} loading={false} />
        )}
        {pending ? (
          <span
            role="status"
            className="pointer-events-none absolute top-3 left-3 rounded-sm border border-border-dark bg-panel-dark px-2 py-1 text-caption text-glass-dark-text"
          >
            {t('fleet.preview.pending')}
          </span>
        ) : null}
      </div>
      <p className="text-small text-glass-dark-muted">{HAS_WEBGL ? t('fleet.preview.hint') : t('fleet.preview.unsupported')}</p>
    </div>
  )
}
