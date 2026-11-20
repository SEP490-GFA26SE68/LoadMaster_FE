import { useEffect, useRef } from 'react'
import { StopDot } from '@/components/StopChip'
import type { StorySource } from '@/features/viewer3d/landing/story-clock'
import { arriveDim, UNLOAD_STOP } from '@/features/viewer3d/landing/story-timeline'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { STAGE_SURFACE } from './LandingStageParts'

/**
 * Chuyển cảnh tới điểm 1 của khung 3D trang giới thiệu: lớp nền `--canvas-2` phủ cả khung tối dần, giữ thẻ "Tới điểm 1 · Siêu thị" đủ đọc
 * rồi sáng lại khi xe đã ở chỗ dỡ (`arriveDim`). Là DOM nằm trên canvas, không thêm draw call; độ tối ghi thẳng vào `style` theo kênh
 * nhanh của chuyện — không qua React mỗi khung hình. Chỉ là hình (`aria-hidden`): thẻ chuyến và Lumo đã nói xe tới đâu.
 */
export function StageArrival({ story, stopName }: { story: StorySource; stopName: string }) {
  const t = useT()
  const format = useFormat()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let last = Number.NaN
    const write = () => {
      const dim = arriveDim(story.time())
      if (dim === last) return
      last = dim
      el.style.opacity = String(dim)
      el.style.visibility = dim > 0 ? 'visible' : 'hidden'
    }
    write()
    return story.subscribe(write)
  }, [story])

  return (
    <div ref={ref} aria-hidden data-stage-arrival="" className="invisible absolute inset-0 grid place-items-center bg-canvas-2 px-4 opacity-0">
      <p className={cn(STAGE_SURFACE, 'm-0 flex items-center gap-3 rounded-lg px-4 py-3 font-display text-h3 leading-6 font-[650] text-sky-text font-stretch-106%')}>
        <StopDot stop={UNLOAD_STOP} />
        {t('landingStage.arrival', { number: format.integer(UNLOAD_STOP), name: stopName })}
      </p>
    </div>
  )
}
