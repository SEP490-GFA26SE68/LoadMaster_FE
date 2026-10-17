import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useState } from 'react'
import { CargoArtwork } from '@/components/CargoArtwork'
import { Spinner } from '@/components/ui/Spinner'
import type { CameraPreset } from '@/features/viewer3d/viewer-types'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { LandingStagePoster } from './LandingStagePoster'
import { StageLegend, StageReadout, StageReplay, StageViews } from './LandingStageParts'
import { StageBoundary } from './StageBoundary'
import { LANDING_REQUEST, LANDING_STOP_COUNT } from './landing-sample.mock'
import { useLandingSample } from './useLandingSample'
import { useStageGate } from './useStageGate'

const loadViewer = () => import('@/features/viewer3d/LandingStageViewer')
const LandingStageViewer = lazy(loadViewer)

/** Quá lâu chưa có khung hình đầu (tải hỏng, tạo ngữ cảnh WebGL lỗi — lỗi đó không qua `StageBoundary`): đổi sang hình minh hoạ. */
const STAGE_TIMEOUT_MS = 15_000

const PACKAGE_COUNT = LANDING_REQUEST.packages.reduce((count, line) => count + line.quantity, 0)
const { innerLengthCm, innerWidthCm, innerHeightCm } = LANDING_REQUEST.vehicle

/**
 * Khung 3D của phần mở đầu trang giới thiệu. Lần vẽ đầu chỉ có chữ và ảnh tĩnh của thùng rỗng; khi trình duyệt rảnh, trang tải bộ máy
 * 3D của ứng dụng và cho bộ tối ưu mô phỏng tính chuyến mẫu ngay trên máy người xem, rồi khung hình thay ảnh tĩnh và xếp đầy thùng một
 * lần (khoảng 3 giây). Không có WebGL, bật tiết kiệm dữ liệu, hay tải / tính hỏng: hình minh hoạ SVG (`CargoArtwork`), không số nào.
 * Số của lần chạy luôn kèm MOCK RESULT.
 */
export function LandingStage() {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const reducedMotion = usePrefersReducedMotion()
  const gate = useStageGate()
  const sample = useLandingSample(gate === 'go')
  const [failed, setFailed] = useState(false)
  const [ready, setReady] = useState(false)
  const [preset, setPreset] = useState<CameraPreset>('goc-cheo')
  const [playKey, setPlayKey] = useState(0)
  const stopNames = useMemo(
    () => [t('landing.sample.stop1'), t('landing.sample.stop2'), t('landing.sample.stop3'), t('landing.sample.stop4')],
    [t],
  )
  const handleReady = useCallback(() => setReady(true), [])
  const handleError = useCallback(() => setFailed(true), [])
  const handleReplay = useCallback(() => setPlayKey((key) => key + 1), [])

  // Tải phần 3D song song với lần chạy tối ưu; lỗi tải để `lazy` báo lại cho `StageBoundary`.
  useEffect(() => {
    if (gate === 'go') loadViewer().catch(() => {})
  }, [gate])
  useEffect(() => {
    if (gate !== 'go' || ready || failed) return
    const timer = window.setTimeout(handleError, STAGE_TIMEOUT_MS)
    return () => window.clearTimeout(timer)
  }, [gate, ready, failed, handleError])

  if (gate === 'off' || failed || sample.isError) {
    return (
      <figure className="landing-stage-surface relative m-0 flex flex-col gap-3 rounded-xl p-4 sm:p-5">
        <span aria-hidden className="landing-stage-glow" />
        <CargoArtwork label={t('landing.hero.artworkLabel')} className="max-h-[46vh]" />
        <figcaption className="text-small text-sky-text-3 pointer-coarse:text-body-lg">{t('landing.stage.artworkCaption')}</figcaption>
      </figure>
    )
  }

  const live = ready && sample.data !== undefined
  return (
    <figure aria-labelledby={titleId} className="landing-stage-surface relative m-0 flex min-w-0 flex-col rounded-xl">
      <span aria-hidden className="landing-stage-glow" />
      {/* Hẹp: tên thùng + "Xếp lại" một hàng, góc nhìn xuống hàng riêng rộng hết khung; rộng: cả ba một hàng */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 pt-4 sm:px-5">
        <div className="mr-auto flex min-w-0 flex-col">
          <p id={titleId} className="m-0 font-display text-h3 font-semibold text-sky-text font-stretch-108%">{t('landing.stage.title')}</p>
          <span className="font-mono text-small text-sky-text-3 tabular-nums">{format.dimensions(innerLengthCm, innerWidthCm, innerHeightCm)}</span>
        </div>
        {live ? <StageViews preset={preset} onPreset={setPreset} className="order-last basis-full sm:order-none sm:basis-auto" /> : null}
        {live && !reducedMotion ? <StageReplay onReplay={handleReplay} /> : null}
      </div>

      <div className="relative mx-2 mt-3 aspect-16/10 overflow-hidden rounded-lg bg-canvas-1 sm:mx-3">
        {sample.data ? (
          <div aria-hidden className="absolute inset-0">
            <StageBoundary onError={handleError}>
              <Suspense fallback={null}>
                <LandingStageViewer request={LANDING_REQUEST} result={sample.data} stopNames={stopNames} preset={preset}
                  playKey={playKey} onReady={handleReady} onFail={handleError} />
              </Suspense>
            </StageBoundary>
          </div>
        ) : null}
        <LandingStagePoster className={cn('pointer-events-none absolute inset-0 transition-opacity duration-(--dur-md) ease-standard', live && 'opacity-0')} />
        {live ? null : (
          <p className="absolute bottom-3 left-3 m-0 inline-flex items-center gap-2 rounded-md bg-canvas-2 px-3 py-2 text-small text-sky-text-2 pointer-coarse:text-body-lg">
            <Spinner tone="light" label={t('landing.stage.preparing')} />
            <span aria-hidden>{t('landing.stage.preparing')}</span>
          </p>
        )}
      </div>

      {live ? (
        <div className="px-4 pt-3 sm:px-5">
          <StageLegend stopNames={stopNames} />
        </div>
      ) : null}
      {live && sample.data ? <div className="mt-3"><StageReadout result={sample.data} /></div> : null}
      <figcaption className={cn('px-4 pb-4 text-small text-sky-text-3 pointer-coarse:text-body-lg sm:px-5', live ? 'pt-0' : 'pt-4')}>
        {t('landing.stage.caption', { count: format.integer(PACKAGE_COUNT), stops: format.integer(LANDING_STOP_COUNT) })}
      </figcaption>
    </figure>
  )
}
