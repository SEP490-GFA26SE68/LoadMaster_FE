import { useState } from 'react'
import type { ViewerSceneModel } from './scene-input'
import type { CameraPreset } from './viewer-types'
import { SceneCanvas } from './scene/SceneCanvas'
import { usePerformanceFlags } from './usePerformanceFlags'

type Props = {
  model: ViewerSceneModel
}

/**
 * 3D Viewer chỉ đọc cho LoadPlan từ Spring Boot.
 * Không chỉnh sửa, ghim kiện hoặc ghi dữ liệu Backend.
 */
export function BackendLoadPlanViewer({ model }: Props) {
  const flags = usePerformanceFlags(undefined, 'planner')

  const [cameraPreset] = useState<CameraPreset>('goc-cheo')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const totalSteps = Math.max(
    0,
    ...model.placements.map((placement) => placement.step),
  )

  // Hiển thị toàn bộ kiện ngay khi mở Viewer.
  const [step, setStep] = useState(totalSteps)

  return (
    <div className="relative h-[520px] w-full overflow-hidden rounded-xl">
      <SceneCanvas
        experience="planner"
        model={model}
        placements={model.placements}
        flags={flags}
        preset={cameraPreset}
        selectedId={selectedId}
        onSelect={setSelectedId}
        sliceCm={model.vehicle.innerLengthCm}
        step={step}
        animateLoading={false}
        decoration
      />

      {totalSteps > 0 && (
        <div className="absolute bottom-4 left-4 z-10 flex items-center gap-3 rounded-lg bg-black/70 px-4 py-3 text-white">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step <= 1}
            className="rounded border border-white/30 px-3 py-1 disabled:opacity-40"
            aria-label="Previous loading step"
          >
            ←
          </button>

          <span className="min-w-12 text-center text-sm tabular-nums">
            {step}/{totalSteps}
          </span>

          <button
            type="button"
            onClick={() =>
              setStep((current) => Math.min(totalSteps, current + 1))
            }
            disabled={step >= totalSteps}
            className="rounded border border-white/30 px-3 py-1 disabled:opacity-40"
            aria-label="Next loading step"
          >
            →
          </button>
        </div>
      )}
    </div>
  )
}