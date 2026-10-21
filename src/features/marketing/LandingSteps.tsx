import { useT } from '@/lib/i18n'
import { SectionHeading } from './SectionHeading'

const STEPS = ['intake', 'plan', 'optimize', 'operate'] as const

/**
 * "Cách hoạt động" của trang giới thiệu (`#cach-hoat-dong`): bốn bước của một chuyến hàng, danh sách có thứ tự. Số bước là hình (ẩn với
 * trình đọc màn hình, danh sách đã đọc thứ tự); tiêu đề mỗi bước mang chữ "Bước n" ẩn để nghe vẫn rõ.
 */
export function LandingSteps() {
  const t = useT()
  return (
    <section id="cach-hoat-dong" aria-labelledby="landing-how" className="scroll-mt-24 border-y border-border bg-bg px-4 py-14 md:px-shell lg:py-18">
      <SectionHeading id="landing-how" title={t('landing.how.title')} lede={t('landing.how.lede')} />
      <ol className="m-0 mt-8 grid list-none gap-4 p-0 md:grid-cols-2 xl:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step} className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-5">
            <span aria-hidden className="grid size-9 place-items-center rounded-md bg-primary-bg font-display text-h3 font-bold text-primary">
              {index + 1}
            </span>
            <h3 className="m-0 font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%">
              <span className="sr-only">{t('landing.how.step', { number: index + 1 })}: </span>
              {t(`landing.how.steps.${step}.title`)}
            </h3>
            <p className="m-0 text-body text-ink-2 pointer-coarse:text-body-lg">{t(`landing.how.steps.${step}.text`)}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
