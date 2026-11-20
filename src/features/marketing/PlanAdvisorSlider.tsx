import { useId } from 'react'
import { useT } from '@/lib/i18n'
import type { PlanAdvice } from './assistant/assistant-advisor'

/**
 * Các mức của thanh kéo "số lần chạy mỗi tháng": không đều, dày ở dải thấp; có 1.500 và 5.000 — chỗ đổi gói của danh mục mẫu (3.000 và
 * 10.000 credit tháng, 2 credit một lần chạy). Danh mục đổi thì phép tính vẫn đúng, chỉ chỗ đổi gói rơi giữa hai mức.
 */
export const RUN_STOPS = [50, 100, 200, 300, 500, 750, 1_000, 1_500, 2_000, 3_000, 4_000, 5_000, 6_000, 8_000, 10_000] as const
/** Mức đứng sẵn: 300 lần mỗi tháng (mức chọn nhanh đầu tiên của trợ lý). */
export const DEFAULT_STOP = 3

export const runsAt = (stop: number): number => RUN_STOPS[stop] ?? RUN_STOPS[DEFAULT_STOP]

/**
 * Thanh kéo dưới các gói của trang giới thiệu: khách chọn số lần chạy tối ưu 3D mỗi tháng, thấy phép tính credit và gói rẻ nhất đủ dùng —
 * cùng phép tính `advise` với trợ lý Lumo. Thanh kéo gốc của trình duyệt (phím mũi tên, `aria-valuetext` là số lần chạy); chỉ câu gói
 * gợi ý được đọc lại khi đổi (`aria-live`), thẻ gói tương ứng mang nhãn "Rẻ nhất đủ dùng".
 */
export function PlanAdvisorSlider({ stop, advice, onStop }: { stop: number; advice: PlanAdvice; onStop: (stop: number) => void }) {
  const t = useT()
  const id = useId()
  const runs = t('landing.plans.advisor.runs', { count: advice.runs })
  return (
    <div className="mt-6 flex flex-col gap-3 rounded-lg border border-border bg-bg p-5 sm:p-6" data-plan-advisor="">
      <label htmlFor={id} className="text-body-lg font-semibold text-ink-strong">{t('landing.plans.advisor.label')}</label>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
        <input
          id={id}
          type="range"
          min={0}
          max={RUN_STOPS.length - 1}
          step={1}
          value={stop}
          aria-valuetext={runs}
          onChange={(event) => onStop(Number(event.target.value))}
          className="h-11 min-w-0 flex-1 basis-64 cursor-pointer accent-primary pointer-coarse:h-14"
        />
        <output htmlFor={id} className="font-display text-h2 font-bold whitespace-nowrap text-ink-strong tabular-nums font-stretch-108%">{runs}</output>
      </div>
      <p className="m-0 text-body-lg text-ink-2">
        {t('landing.plans.advisor.math', { count: advice.runs, cost: advice.cost, credits: advice.credits })}
      </p>
      <p aria-live="polite" className="m-0 text-body-lg font-semibold text-ink-strong">
        {advice.plan
          ? t('landing.plans.advisor.pick', { name: advice.plan.name })
          : t('landing.plans.advisor.none', { credits: advice.credits })}
      </p>
      <p className="m-0 text-small text-ink-3 pointer-coarse:text-body-lg">{t('landing.plans.advisor.caveat')}</p>
    </div>
  )
}
