import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { CargoArtwork } from '@/components/CargoArtwork'
import type { OptimizationResult } from '@/domain/models'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CONTROL, STAGE_SURFACE } from '../LandingStageParts'
import { LANDING_REQUEST } from '../landing-sample.mock'
import { StageBoundary } from '../StageBoundary'
import { useStageGate } from '../useStageGate'
import { SAMPLE_VIEWS, type SamplePlanState, type SampleView } from './sample-plan-url'

const loadViewer = () => import('@/features/viewer3d/SamplePlanViewer')
const SamplePlanViewer = lazy(loadViewer)

/** Quá lâu chưa có khung hình đầu (tải hỏng, tạo ngữ cảnh WebGL lỗi — lỗi đó không qua `StageBoundary`): đổi sang hình minh hoạ. */
const STAGE_TIMEOUT_MS = 15_000

/** Bốn góc nhìn, nằm đè góc trên trái khung; điện thoại: bốn cột bằng nhau hết bề rộng khung, cao 56 px, nhãn dài xuống dòng. */
function SampleViews({ view, onChange }: { view: SampleView; onChange: (view: SampleView) => void }) {
  const t = useT()
  return (
    <div role="group" aria-label={t('samplePlan.views')}
      className={cn(STAGE_SURFACE, 'pointer-events-auto absolute top-2 right-2 left-2 grid grid-cols-4 overflow-hidden sm:top-4 sm:right-auto sm:left-4 sm:inline-flex')}>
      {SAMPLE_VIEWS.map((key) => (
        <button key={key} type="button" aria-pressed={key === view} onClick={() => onChange(key)}
          className={cn(CONTROL, 'px-2 text-center text-balance aria-pressed:bg-cyan-400/20 aria-pressed:text-sky-text aria-pressed:shadow-[inset_0_0_0_1px_var(--cyan-300)]',
            'forced-colors:aria-pressed:border-b-4 forced-colors:aria-pressed:border-transparent sm:px-3')}>
          {t(`samplePlan.view.${key}`)}
        </button>
      ))}
    </div>
  )
}

/** Không có WebGL, tải hỏng hay mất ngữ cảnh: hình minh hoạ SVG kèm câu nói vì sao — số của phương án vẫn ở cột bên cạnh. */
function SampleFallback({ text }: { text: string }) {
  const t = useT()
  return (
    <figure className="m-0 flex h-full flex-col items-center justify-center gap-3 p-4 sm:p-6">
      <CargoArtwork label={t('landing.hero.artworkLabel')} className="max-h-[52svh] w-full max-w-2xl" />
      <figcaption className="max-w-xl text-center text-small text-sky-text-3 pointer-coarse:text-body-lg">{text}</figcaption>
    </figure>
  )
}

/**
 * Khung 3D của `/phuong-an-mau`: cổng `useStageGate` như khung mở đầu (không WebGL, tiết kiệm dữ liệu: hình minh hoạ, không tải Three.js),
 * phần 3D `viewer3d/SamplePlanViewer` tải lười, khung hình đầu vẽ xong mới thôi chữ chờ. Lỗi tải, quá 15 giây chưa có khung hình hay mất ngữ
 * cảnh WebGL: hình minh hoạ. Bộ tối ưu tính hỏng: một câu, không hình.
 */
export function SamplePlanStage({ state, result, failed: sampleFailed, autoplay, label, stopNames, onView }: {
  state: SamplePlanState
  /** Phương án đang xem; chưa tính xong: `undefined`. */
  result: OptimizationResult | undefined
  /** Bộ tối ưu mô phỏng không tính được chuyến mẫu. */
  failed: boolean
  autoplay: boolean
  label: string
  stopNames: readonly string[]
  onView: (view: SampleView) => void
}) {
  const t = useT()
  const [box, setBox] = useState<HTMLDivElement | null>(null)
  const gate = useStageGate(box)
  const [broken, setBroken] = useState(false)
  const [frameReady, setFrameReady] = useState(false)
  const handleReady = useCallback(() => setFrameReady(true), [])
  const handleError = useCallback(() => setBroken(true), [])

  useEffect(() => {
    if (gate === 'go') loadViewer().catch(() => {})
  }, [gate])
  // Chỉ đếm giờ khi tab đang hiện: tab ẩn không vẽ khung hình nào
  useEffect(() => {
    if (gate !== 'go' || frameReady || broken) return
    let timer = 0
    const arm = () => {
      window.clearTimeout(timer)
      timer = document.hidden ? 0 : window.setTimeout(handleError, STAGE_TIMEOUT_MS)
    }
    arm()
    document.addEventListener('visibilitychange', arm)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', arm)
    }
  }, [gate, frameReady, broken, handleError])

  const live = gate === 'go' && !broken && !sampleFailed
  return (
    <div ref={setBox} data-stage={sampleFailed ? 'failed' : live ? (frameReady ? 'ready' : 'loading') : 'fallback'} className="relative h-full min-h-0">
      {sampleFailed ? (
        <p role="alert" className="m-0 flex h-full items-center justify-center p-6 text-center text-body text-sky-text-2">{t('samplePlan.failed')}</p>
      ) : !live && gate !== 'wait' ? <SampleFallback text={t('samplePlan.fallback')} /> : null}
      {live && result ? (
        <div className="absolute inset-0 isolate">
          <StageBoundary onError={handleError}>
            <Suspense fallback={null}>
              <SamplePlanViewer request={LANDING_REQUEST} result={result} stopNames={stopNames} mode={state.mode} stop={state.stop}
                view={state.view} autoplay={autoplay} label={label} onReady={handleReady} onFail={handleError} />
            </Suspense>
          </StageBoundary>
        </div>
      ) : null}
      {(gate === 'wait' || live) && !frameReady && !sampleFailed ? (
        <p role="status" className="pointer-events-none absolute inset-0 m-0 flex items-center justify-center p-6 text-center text-body text-sky-text-2 pointer-coarse:text-body-lg">
          {t('samplePlan.computing')}
        </p>
      ) : null}
      {live && frameReady ? <SampleViews view={state.view} onChange={onView} /> : null}
    </div>
  )
}
