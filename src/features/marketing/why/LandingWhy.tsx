import { useId, useState } from 'react'
import { SKY_FOCUS } from '@/components/sky-focus'
import { PLAN_OBJECTIVES } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Reveal } from '../reveal'
import { orderCount, orientationCount, ORIENTATIONS_PER_PACKAGE, WHY_PACKAGES, WHY_STOPS, type BigCount } from './why-count'

const LABEL = 'text-body-lg font-semibold text-sky-text'

/** Một số đếm: viết đủ khi nhỏ; khi lớn là "≈ a × 10^b" cho mắt, kèm câu đọc thành lời cho trình đọc màn hình và số chữ số của số thật. */
function Count({ label, count }: { label: string; count: BigCount }) {
  const t = useT()
  const format = useFormat()
  return (
    <div className="flex min-w-0 flex-col gap-1 border-t border-landing-hairline pt-3">
      <dt className="text-body-lg text-pretty text-sky-text-2">{label}</dt>
      <dd className="m-0 flex flex-col gap-0.5">
        <span className="font-display text-h2 font-bold whitespace-nowrap text-sky-text tabular-nums font-stretch-108% sm:text-h1 lg:text-display">
          {count.kind === 'exact' ? (
            format.integer(count.value)
          ) : (
            <>
              <span aria-hidden>
                ≈ {format.decimal(count.mantissa)} × 10<sup>{count.exponent}</sup>
              </span>
              <span className="sr-only">{t('landingWhy.approx', { mantissa: format.decimal(count.mantissa), exponent: count.exponent })}</span>
            </>
          )}
        </span>
        {count.kind === 'power' ? (
          <span className="text-body-lg text-sky-text-2">{t('landingWhy.digits', { count: count.digits })}</span>
        ) : null}
      </dd>
    </div>
  )
}

/**
 * Dải "Vì sao xếp tay không xuể", cuối khối tối mở đầu: khách chọn số điểm giao (thanh kéo gốc của trình duyệt) và số kiện (bốn mốc,
 * nhóm radio gốc), trang đếm tại chỗ số thứ tự đi qua các điểm và số cách chọn hướng đặt (`why-count.ts`) rồi nói bộ tối ưu trả về mấy
 * phương án (`PLAN_OBJECTIVES`). Mốc đứng sẵn là chuyến mẫu của trang. Hai số đếm được đọc lại khi đổi (`aria-live`). Nền tối nên vòng
 * focus là cyan sáng (`SKY_FOCUS`). Không nút chính: nút chính của trang nằm ở khối mở đầu.
 */
export function LandingWhy() {
  const t = useT()
  const format = useFormat()
  const id = useId()
  const [stops, setStops] = useState<number>(WHY_STOPS.initial)
  const [packages, setPackages] = useState<number>(WHY_PACKAGES.initial)
  const stopsText = t('landingWhy.stops.value', { count: stops })
  return (
    <section aria-labelledby="landing-why" className="border-t border-landing-hairline px-4 py-7 md:px-shell lg:py-10">
      <Reveal className="grid gap-x-14 gap-y-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center">
        <div className="flex min-w-0 flex-col gap-3 lg:gap-4">
          <h2 id="landing-why" className="m-0 font-display text-h2 font-bold tracking-[-0.01em] text-balance text-sky-text font-stretch-108% lg:text-h1">
            {t('landingWhy.title')}
          </h2>
          <div className="flex flex-col">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor={`${id}-stops`} className={LABEL}>{t('landingWhy.stops.label')}</label>
              <output htmlFor={`${id}-stops`} className="text-body-lg text-sky-text-2 tabular-nums">{stopsText}</output>
            </div>
            <input
              id={`${id}-stops`}
              type="range"
              min={WHY_STOPS.min}
              max={WHY_STOPS.max}
              step={1}
              value={stops}
              aria-valuetext={stopsText}
              onChange={(event) => setStops(Number(event.target.value))}
              className={cn('h-11 w-full min-w-0 cursor-pointer rounded-md accent-cyan-400 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 pointer-coarse:h-14', SKY_FOCUS)}
            />
          </div>
          <fieldset className="m-0 min-w-0 border-0 p-0">
            <legend className={cn(LABEL, 'mb-2 p-0')}>{t('landingWhy.packages.label')}</legend>
            <div className="grid grid-cols-4 gap-2">
              {WHY_PACKAGES.marks.map((mark) => (
                <label key={mark} className="relative block cursor-pointer">
                  <input
                    type="radio"
                    name={`${id}-packages`}
                    value={mark}
                    checked={packages === mark}
                    onChange={() => setPackages(mark)}
                    className="peer sr-only"
                  />
                  <span className="grid h-11 place-items-center rounded-md border border-sky-glass-border bg-sky-glass text-body-lg font-semibold text-sky-text-2 tabular-nums transition-colors duration-(--dur-fast) ease-standard peer-checked:border-transparent peer-checked:bg-(image:--nav-on) peer-checked:text-sky-text peer-checked:shadow-nav-on hover:bg-sky-glass-hover peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-cyan-300 pointer-coarse:h-14">
                    {format.integer(mark)}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>
        <div className="flex min-w-0 flex-col gap-3 lg:gap-5">
          <dl aria-live="polite" className="m-0 grid grid-cols-2 gap-x-6">
            <Count label={t('landingWhy.orders', { count: stops })} count={orderCount(stops)} />
            <Count label={t('landingWhy.orientations', { count: packages })} count={orientationCount(packages)} />
          </dl>
          <p className="m-0 max-w-[40em] text-body-lg text-pretty text-sky-text-2">
            {t('landingWhy.closing', { base: ORIENTATIONS_PER_PACKAGE, count: PLAN_OBJECTIVES.length })}
          </p>
        </div>
      </Reveal>
    </section>
  )
}
