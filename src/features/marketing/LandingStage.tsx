import { lazy, Suspense, useCallback, useEffect, useId, useMemo, useState } from 'react'
import { CargoArtwork } from '@/components/CargoArtwork'
import type { StageView } from '@/features/viewer3d/landing/diorama-layout'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { DioramaPoster } from './DioramaPoster'
import { StageReadout, StageRoute, StageViews, StoryButton } from './LandingStageParts'
import { StageBoundary } from './StageBoundary'
import { StoryNarrator, type NarratorLine } from './StoryNarrator'
import { StoryTripCard, StoryTripCardLive } from './StoryTripCard'
import { LANDING_REQUEST, LANDING_STOP_COUNT } from './landing-sample.mock'
import { useHeroFit } from './useHeroFit'
import { useLandingSample } from './useLandingSample'
import { useStageGate } from './useStageGate'
import { useStoryDriver, useStoryPhase, useStoryStatus } from './useStoryDriver'

const loadViewer = () => import('@/features/viewer3d/LandingStageViewer')
const LandingStageViewer = lazy(loadViewer)

/** Quá lâu chưa có khung hình đầu (tải hỏng, tạo ngữ cảnh WebGL lỗi — lỗi đó không qua `StageBoundary`): đổi sang hình minh hoạ. */
const STAGE_TIMEOUT_MS = 15_000

/** Số kiện của yêu cầu mẫu (366): thẻ chuyến, tổng của "Đang xếp n / 366" và của dải số. */
const PACKAGE_COUNT = LANDING_REQUEST.packages.reduce((count, line) => count + line.quantity, 0)

/**
 * Nhãn "Cửa sau · Hướng dỡ" của khung 3D chỉ hiện ở góc Thùng xe: góc Toàn cảnh có cầu dẫn nằm đúng chỗ đó, góc Vùng điểm giao có nhãn
 * vùng; điện thoại thì nhãn xuống hai dòng và bị mép khung cắt.
 */
const DOOR_CUE = 'max-sm:[&_[data-rear-door-cue]]:hidden [&:not([data-view=truck])_[data-rear-door-cue]]:hidden'
/** Khung cao 600 px từ 1.440 px, 560 px tới 1.439 px; hẹp hơn theo tỉ lệ. */
const BOX = { wide: 'h-140 min-[90rem]:h-150', medium: 'aspect-[16/10]', narrow: 'aspect-[4/3]' } as const

/** Không có WebGL, tiết kiệm dữ liệu, tải hay tính hỏng: hình minh hoạ SVG kèm câu không nói gì về lần chạy, và Lumo nói vì sao. */
function StageFallback() {
  const t = useT()
  return (
    <div className="flex min-w-0 flex-col gap-4">
      <figure className="landing-stage-surface relative m-0 flex flex-col gap-3 rounded-xl p-4 sm:p-5">
        <span aria-hidden className="landing-stage-glow" />
        <CargoArtwork label={t('landing.hero.artworkLabel')} className="max-h-[46vh]" />
        <figcaption className="text-small text-sky-text-3 pointer-coarse:text-body-lg">{t('landing.stage.artworkCaption')}</figcaption>
      </figure>
      <StoryNarrator line="fallback" layout="row" />
    </div>
  )
}

/**
 * Khung 3D "Sân kho kể chuyện" của phần mở đầu trang giới thiệu. Lần vẽ đầu là ảnh tĩnh của sân kho (`DioramaPoster`); khi trình duyệt
 * rảnh và khung đã tới gần khung nhìn (`useStageGate`), trang tải bộ máy 3D của ứng dụng và cho bộ tối ưu mô phỏng tính chuyến mẫu ngay
 * trên máy người xem, rồi khung hình thay ảnh tĩnh và chuyện 15 giây chạy một lần (`useStoryDriver`): kiện vào làn → tối ưu → xếp → xếp
 * xong → cửa thùng đóng, xe nổ máy và lăn bánh rời kho (giảm chuyển động: dừng ở xếp xong). Quanh khung: thẻ chuyến với chip của ứng
 * dụng, Lumo dẫn chuyện, nút ba trạng thái, ba góc nhìn, hàng "Thứ tự giao" và dải số của lần chạy (MOCK RESULT, chỉ khi xếp xong). Từ
 * 1.280 px thẻ, nút và Lumo nằm đè trên khung; hẹp hơn thì thẻ ở trên, Lumo ở dưới khung. Không có WebGL hay hỏng: `StageFallback`.
 */
export function LandingStage() {
  const t = useT()
  const format = useFormat()
  const { tier, insets, defaultView } = useHeroFit()
  const reducedMotion = usePrefersReducedMotion()
  const [figure, setFigure] = useState<HTMLElement | null>(null)
  const gate = useStageGate(figure)
  const sample = useLandingSample(gate === 'go')
  const result = sample.data
  const [failed, setFailed] = useState(false)
  const [frameReady, setFrameReady] = useState(false)
  const [chosen, setChosen] = useState<StageView | null>(null)
  const view = chosen ?? defaultView
  const driver = useStoryDriver({ sampleReady: result !== undefined, frameReady, reducedMotion })
  const { story, observe, toggle } = driver
  const status = useStoryStatus(driver)
  const phase = useStoryPhase(driver)
  const titleId = useId()
  const captionId = useId()
  const stopNames = useMemo(
    () => [t('landing.sample.stop1'), t('landing.sample.stop2'), t('landing.sample.stop3'), t('landing.sample.stop4')],
    [t],
  )
  const handleReady = useCallback(() => setFrameReady(true), [])
  const handleError = useCallback(() => setFailed(true), [])

  // Tải phần 3D song song với lần chạy tối ưu; lỗi tải để `lazy` báo lại cho `StageBoundary`.
  useEffect(() => {
    if (gate === 'go') loadViewer().catch(() => {})
  }, [gate])
  // Chỉ đếm giờ khi tab đang hiện: tab ẩn không vẽ khung hình nào (trình duyệt dừng requestAnimationFrame), hiện lại thì đếm lại từ đầu
  useEffect(() => {
    if (gate !== 'go' || frameReady || failed) return
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
  }, [gate, frameReady, failed, handleError])

  if (gate === 'off' || failed || sample.isError) return <StageFallback />

  const wide = tier === 'wide'
  const going = gate === 'go'
  const placed = result?.placements.length ?? 0
  const line: NarratorLine | null = !going ? null : phase === 'ready' && result && placed < PACKAGE_COUNT ? 'readyPartial' : phase
  // Số của lần chạy hiện từ lúc xếp xong và ở lại khi xe rời kho
  const loaded = phase === 'ready' || phase === 'depart'
  const views = <StageViews view={view} onChange={setChosen} layout={tier === 'narrow' ? 'segmented' : 'inline'} className={tier === 'narrow' ? 'mt-3 w-full' : undefined} />
  const button = reducedMotion ? null : <StoryButton status={status} onToggle={toggle} compact={tier === 'narrow'} />
  // Chỉ nút tạm dừng làm chữ đứng lại; khung bị cuộn khuất thì câu đang gõ vẫn gõ xong (tối đa 1 giây), pha giữ nguyên nên câu không đổi
  const narrator = <StoryNarrator line={line} paused={status === 'paused'} layout={wide ? 'overlay' : 'row'} preload={going} />
  // Thẻ chuyến: từ 1.280 px nằm đè góc trên phải khung; hẹp hơn nằm trên khung — lúc chưa tải phần 3D vẫn giữ chỗ (trong suốt)
  const card = going ? (
    <StoryTripCardLive driver={driver} resolved={result !== undefined} placed={placed} total={PACKAGE_COUNT} titleId={titleId} compact={wide}
      className={wide ? 'absolute top-4 right-4 w-72' : 'mb-3 md:max-w-105'} />
  ) : wide ? null : <StoryTripCard phase="preparing" recorded={0} total={PACKAGE_COUNT} className="invisible mb-3 md:max-w-105" />

  return (
    <figure ref={setFigure} aria-labelledby={going ? titleId : undefined} aria-describedby={captionId} data-story-status={status} data-story-phase={phase}
      data-paused={status === 'paused' ? '' : undefined} className="m-0 flex min-w-0 flex-col">
      {wide ? null : card}
      <div className="relative">
        <span aria-hidden className="landing-stage-glow" />
        <div ref={observe} data-view={view} className={cn('landing-stage-surface relative overflow-hidden rounded-xl', BOX[tier], DOOR_CUE)}>
          {/* `isolate`: z-index của nhãn neo drei (`<Html>`, như "Cửa sau · Hướng dỡ") ở lại trong lớp 3D, không vẽ đè thẻ, Lumo và nút */}
          {result ? (
            <div aria-hidden className="absolute inset-0 isolate">
              <StageBoundary onError={handleError}>
                <Suspense fallback={null}>
                  <LandingStageViewer request={LANDING_REQUEST} result={result} stopNames={stopNames} view={view} tier={tier}
                    story={story} onReady={handleReady} onFail={handleError} />
                </Suspense>
              </StageBoundary>
            </div>
          ) : null}
          <DioramaPoster view={view} insets={insets}
            className={cn('pointer-events-none absolute inset-0 transition-opacity duration-(--dur-md) ease-standard motion-reduce:transition-none', frameReady && 'opacity-0')} />
          <div className="pointer-events-none absolute inset-0">
            {tier === 'narrow' ? (
              <div className="pointer-events-auto absolute top-4 right-4">{button}</div>
            ) : (
              <div className="pointer-events-auto absolute top-4 left-4 flex gap-2">{views}{wide ? null : button}</div>
            )}
            {wide ? (
              <>
                {card}
                <div className="absolute bottom-4 left-4">{narrator}</div>
                <div className="pointer-events-auto absolute right-4 bottom-4">{button}</div>
              </>
            ) : null}
          </div>
        </div>
      </div>
      {tier === 'narrow' ? views : null}
      {wide ? null : <div className="mt-3">{narrator}</div>}
      <StageRoute stopNames={stopNames} className="mt-4" />
      <StageReadout result={loaded && result ? result : null} total={PACKAGE_COUNT} className="mt-3" />
      <figcaption id={captionId} className="sr-only">
        {t('landing.stage.caption', { count: format.integer(PACKAGE_COUNT), stops: format.integer(LANDING_STOP_COUNT) })}
        {reducedMotion ? null : ` ${t('landingStage.caption')}`}
      </figcaption>
    </figure>
  )
}
