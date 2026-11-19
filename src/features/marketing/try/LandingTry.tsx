import { zodResolver } from '@hookform/resolvers/zod'
import { Calculator, ShieldCheck } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PUBLIC_TOUCH } from '../public-chrome'
import { Reveal } from '../reveal'
import { SectionHeading } from '../SectionHeading'
import { toTryInput, TRY_DEFAULTS, tryFormSchema, type TryFormValues } from './try-form'
import { TryCartonFields } from './TryCartonFields'
import { TRY_NOTE } from './TryNumberInput'
import { TryResults } from './TryResults'
import { TryTruckFields } from './TryTruckFields'
import { useTryRun } from './useTryRun'

/** Neo của phần trên trang giới thiệu. */
export const TRY_ANCHOR = 'thu-ngay'

/**
 * "Thử với hàng của bạn" (`#thu-ngay`): khách nhập lòng thùng xe (cm, kg) và một tới bốn loại kiện (kèm điểm giao), bấm "Tính ba phương
 * án" — nút phụ, vì nút chính duy nhất của trang nằm ở phần mở đầu — và bộ tối ưu mô phỏng của ứng dụng chạy **một lần** ngay trên trình
 * duyệt (Web Worker khi có), ra ba phương án A · B · C theo ba mục tiêu. Không tài khoản, không credit, không máy chủ; chỉ chạy khi bấm,
 * bấm lại trong lúc đang tính thì lần cũ bị bỏ. Từ 1.280 px form trái, kết quả phải; hẹp hơn xếp chồng. Trong lúc tính, nút giữ nguyên
 * chiều rộng (icon đổi thành vòng quay) và vẫn bấm được.
 */
export function LandingTry() {
  const t = useT()
  const form = useForm<TryFormValues>({ resolver: zodResolver(tryFormSchema), defaultValues: TRY_DEFAULTS, mode: 'onTouched' })
  const run = useTryRun()
  const running = run.isPending

  const handleValid = (values: TryFormValues) => {
    const input = toTryInput(values)
    if (input !== null) run.mutate(input)
  }

  return (
    <section id={TRY_ANCHOR} aria-labelledby="landing-try" className="scroll-mt-24 px-4 py-16 md:px-shell lg:py-24">
      <SectionHeading id="landing-try" title={t('landingTry.title')} lede={t('landingTry.lede')} />
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:items-start">
        <Reveal className="min-w-0">
          <Card className="p-4 sm:p-5">
            <form noValidate aria-label={t('landingTry.form.label')} onSubmit={form.handleSubmit(handleValid)} className="flex flex-col gap-5">
              <TryTruckFields form={form} />
              <TryCartonFields form={form} />
              <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
                <Button type="submit" variant="secondary" aria-busy={running || undefined} className={cn('self-start', PUBLIC_TOUCH)}>
                  {running ? (
                    // Vùng `status` của cột kết quả đã đọc "đang tính": vòng quay chỉ là hình
                    <span aria-hidden className="contents"><Spinner /></span>
                  ) : (
                    <Calculator aria-hidden strokeWidth={1.5} />
                  )}
                  {t('landingTry.form.run')}
                </Button>
                <p className={cn(TRY_NOTE, 'flex items-start gap-2')}>
                  <ShieldCheck aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 flex-none text-primary" />
                  {t('landingTry.form.privacy')}
                </p>
              </div>
            </form>
          </Card>
        </Reveal>
        <Reveal index={1} className="min-w-0">
          <TryResults control={form.control} run={run} />
        </Reveal>
      </div>
    </section>
  )
}
