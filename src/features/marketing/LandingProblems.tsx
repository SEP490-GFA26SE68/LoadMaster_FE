import { useT } from '@/lib/i18n'
import { Reveal } from './reveal'
import { SectionHeading } from './SectionHeading'

const PROBLEMS = ['buried', 'axle', 'wrong'] as const

/**
 * Dải "Ba chuyện quen thuộc của một chuyến hàng", cuối khối tối của phần mở đầu: ba chuyện người làm vận tải gặp hằng ngày — hàng của
 * điểm đang giao nằm sâu, trục quá tải mà không ai biết, kiện lên nhầm xe hay xuống nhầm điểm — mỗi chuyện kèm việc ứng dụng làm thật.
 * Không con số: số nằm ở "Một chuyến hàng" ngay dưới, kèm nguồn. Ba ý không phải một chuỗi nên không đánh số; mỗi ý nhô lên một lần
 * khi cuộn tới, so le theo cột.
 */
export function LandingProblems() {
  const t = useT()
  return (
    <section aria-labelledby="landing-problems" className="border-t border-landing-hairline px-4 py-10 md:px-shell lg:py-14">
      <SectionHeading id="landing-problems" tone="dark" title={t('landingJourney.problems.title')} lede={t('landingJourney.problems.lede')} />
      <ul className="m-0 mt-8 grid list-none gap-x-10 gap-y-8 p-0 md:grid-cols-3">
        {PROBLEMS.map((key, index) => (
          <Reveal as="li" key={key} index={index} className="relative flex min-w-0 flex-col gap-4 border-t border-landing-hairline pt-6">
            <Reveal as="span" kind="fill-x" aria-hidden className="absolute -top-px left-0 h-px w-10 bg-cyan-300" />
            <p className="m-0 font-display text-h2 leading-8 font-semibold text-balance text-sky-text font-stretch-108%">
              {t(`landingJourney.problems.${key}.problem`)}
            </p>
            <p className="m-0 text-body-lg text-pretty text-sky-text-2">{t(`landingJourney.problems.${key}.answer`)}</p>
          </Reveal>
        ))}
      </ul>
    </section>
  )
}
