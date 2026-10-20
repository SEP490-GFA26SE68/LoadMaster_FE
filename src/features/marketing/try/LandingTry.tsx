import { zodResolver } from '@hookform/resolvers/zod'
import { Calculator, LoaderCircle, ShieldCheck, X } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { TRY_ANCHOR } from '../anchors'
import { PUBLIC_TOUCH } from '../public-chrome'
import { Reveal } from '../reveal'
import { SectionHeading } from '../SectionHeading'
import { toTryInput, TRY_DEFAULTS, tryFormSchema, type TryFormValues } from './try-form'
import { TryCartonFields } from './TryCartonFields'
import { TryPanel } from './TryPanel'
import { TryTruckFields } from './TryTruckFields'
import { useTryRun } from './useTryRun'
import './try.css'

/** Đầu cột kết quả nằm trên mốc này của khung nhìn thì coi như khách đã thấy nó, không cuộn. */
const RESULT_VISIBLE_RATIO = 0.6
const RESULT_ID = 'try-result'

/**
 * "Thử với xe của bạn" (`#thu-xe`): khách nhập lòng thùng xe (cm, kg) và một hoặc hai loại kiện, bấm "Tính thử" (nút phụ — nút chính duy
 * nhất của trang là "Nhận tư vấn" ở phần mở đầu), bộ tối ưu mô phỏng của ứng dụng chạy ngay trên trình duyệt (Web Worker khi có, tải lười
 * lúc bấm) rồi hiện kiện xếp được / tổng, thể tích, khối lượng, kiện chưa xếp kèm lý do và hình đẳng cự SVG — kèm MOCK RESULT. Không tài
 * khoản, không credit, không máy chủ. Xe mẫu và kiện mẫu lấy số từ dữ liệu của ứng dụng. Từ 1.024 px: form trái, kết quả phải (dính khi
 * cuộn); hẹp hơn: xếp chồng, và tính xong mà cột kết quả còn nằm dưới khung nhìn thì trang cuộn tới nó (con trỏ ở lại nút, vùng `status`
 * đã đọc kết quả).
 */
export function LandingTry() {
  const t = useT()
  const form = useForm<TryFormValues>({ resolver: zodResolver(tryFormSchema), defaultValues: TRY_DEFAULTS, mode: 'onTouched' })
  const run = useTryRun()
  const running = run.mutation.isPending

  const revealResult = () => {
    const panel = document.getElementById(RESULT_ID)
    if (!panel || typeof panel.scrollIntoView !== 'function') return
    if (panel.getBoundingClientRect().top < window.innerHeight * RESULT_VISIBLE_RATIO) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    panel.scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' })
  }

  const handleValid = (values: TryFormValues) => {
    const input = toTryInput(values)
    if (input === null || running) return
    run.mutation.mutate(input, { onSuccess: revealResult })
  }

  return (
    <section id={TRY_ANCHOR} aria-labelledby="landing-try" className="scroll-mt-24 px-4 py-16 md:px-shell lg:py-24">
      <SectionHeading id="landing-try" title={t('landingTry.title')} lede={t('landingTry.lede')} />
      <div className="mt-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-start lg:gap-8">
        <Reveal className="min-w-0">
          <Card className="p-5 sm:p-6">
            <form noValidate aria-label={t('landingTry.form.label')} onSubmit={form.handleSubmit(handleValid)} className="flex flex-col gap-6">
              <TryTruckFields form={form} />
              <TryCartonFields form={form} />
              <div className="flex flex-col gap-3 border-t border-line-soft pt-5">
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="submit"
                    variant="secondary"
                    aria-disabled={running || undefined}
                    aria-busy={running || undefined}
                    className={cn('h-11 aria-disabled:cursor-progress', PUBLIC_TOUCH)}
                  >
                    {running ? (
                      <LoaderCircle aria-hidden strokeWidth={1.5} className="animate-spin motion-reduce:animate-none" />
                    ) : (
                      <Calculator aria-hidden strokeWidth={1.5} />
                    )}
                    {t('landingTry.form.run')}
                  </Button>
                  {running ? (
                    <Button type="button" variant="ghost" onClick={run.cancel} className={cn('h-11', PUBLIC_TOUCH)}>
                      <X aria-hidden strokeWidth={1.5} />
                      {t('landingTry.form.cancel')}
                    </Button>
                  ) : null}
                </div>
                <p className="m-0 flex items-start gap-2 text-small text-pretty text-ink-3 pointer-coarse:text-body-lg">
                  <ShieldCheck aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 flex-none text-primary" />
                  {t('landingTry.form.privacy')}
                </p>
              </div>
            </form>
          </Card>
        </Reveal>
        <Reveal index={1} className="min-w-0 lg:sticky lg:top-24">
          <div id={RESULT_ID} className="scroll-mt-24">
            <TryPanel control={form.control} run={run} />
          </div>
        </Reveal>
      </div>
    </section>
  )
}
