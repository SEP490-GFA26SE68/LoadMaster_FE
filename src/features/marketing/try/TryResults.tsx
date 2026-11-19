import { ArrowRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useWatch, type Control } from 'react-hook-form'
import { Link } from 'react-router'
import { Banner } from '@/components/Banner'
import { StopDot } from '@/components/StopChip'
import { Button } from '@/components/ui/Button'
import { PLAN_OBJECTIVES } from '@/domain/models'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { TRIAL_REGISTRATION } from '@/features/auth/landing'
import { REGISTRATION_CAPABILITIES } from '@/features/registration/useRegistrationQuery'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { contactPath } from '../contact-form'
import { PUBLIC_TOUCH } from '../public-chrome'
import { sameInput, toTryInput, type TryFormValues } from './try-form'
import { tryErrorLines } from './try-messages'
import type { TryOutcome } from './try-outcome'
import { scrollResultsIntoView } from './try-scroll'
import { TRY_NOTE } from './TryNumberInput'
import { TryPlanCard, TryPlanPlaceholder } from './TryPlanCard'
import { isAbort, type useTryRun } from './useTryRun'

type TryRun = ReturnType<typeof useTryRun>

/** Câu báo kết quả đang hiện không còn khớp form: theo dõi form bằng `useWatch` ở đây để chỉ dòng này vẽ lại theo từng phím. */
function StaleNote({ control, outcome }: { control: Control<TryFormValues>; outcome: TryOutcome }) {
  const t = useT()
  const values = useWatch({ control }) as TryFormValues
  if (sameInput(toTryInput(values), outcome.input)) return null
  return <Banner tone="warning" className="pointer-coarse:text-body-lg">{t('landingTry.results.stale')}</Banner>
}

/** Chú giải màu điểm giao của hình (màu luôn kèm số và chữ). Chỉ khi hàng có từ hai điểm giao. */
function StopLegend({ outcome }: { outcome: TryOutcome }) {
  const t = useT()
  const stops = [...new Set(outcome.request.packages.map((line) => line.deliveryStop))].sort((a, b) => a - b)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span className={TRY_NOTE}>{t('landingTry.results.legend')}</span>
      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-2 p-0">
        {stops.map((stop) => (
          <li key={stop} className="flex items-center gap-2 text-small text-ink-2 pointer-coarse:text-body-lg">
            <StopDot stop={stop} className="size-6 text-small" />
            {t('landingTry.results.stopName', { number: stop })}
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Lối đi tiếp sau kết quả: khách tự đăng ký được thì "Đăng ký trải nghiệm", không thì "Nhận tư vấn". Người đã đăng nhập không thấy lối đăng ký. */
function NextStep() {
  const t = useT()
  const user = useAuthSafe()?.user
  const signUp = REGISTRATION_CAPABILITIES.publicSignUp && !user
  return (
    <div className="flex flex-col items-start gap-3 border-t border-line-soft pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className={cn(TRY_NOTE, 'text-ink-2')}>{t('landingTry.next.lead')}</p>
      {/* Từ 640 px nút dồn sát mép phải — đúng chỗ nút "Hỏi Lumo": nút đó nâng lên khi chạm */}
      <Button asChild variant="secondary" className={cn('flex-none', PUBLIC_TOUCH)} data-assistant-avoid>
        <Link to={signUp ? TRIAL_REGISTRATION : contactPath({ type: 'DEMO_REQUEST' })}>
          {signUp ? t('landingTry.next.trial') : t('landingTry.next.contact')}{' '}
          {/* Chữ hiện ra trùng nút ở khối mở đầu; phần đuôi chỉ cho trình đọc màn hình để hai liên kết khác tên truy cập */}
          <span className="sr-only">{t('landingTry.next.forYourCargo')}</span>
          <ArrowRight aria-hidden strokeWidth={1.5} />
        </Link>
      </Button>
    </div>
  )
}

/**
 * Cột kết quả: ba thẻ A · B · C cạnh nhau (dưới 640 px xếp chồng), một vùng `status` ẩn đọc "đang tính" / "đã tính xong", rồi các câu
 * nói số đến từ đâu và hàng nào bị bỏ vì sao. Trước lần chạy đầu và trong lúc tính: thẻ giữ chỗ (vạch `aria-hidden`) kèm một câu. Không
 * nhãn MOCK RESULT trên trang công khai — câu nguồn nói số do bộ tối ưu mô phỏng chạy trên trình duyệt tính.
 */
export function TryResults({ control, run }: { control: Control<TryFormValues>; run: TryRun }) {
  const t = useT()
  const format = useFormat()
  const outcome = run.data
  const root = useRef<HTMLDivElement>(null)
  // Mỗi lần tính xong: kết quả mới nằm trong khung nhìn (cột dính có thể đang bị cắt khi nút chạy ở cuối form)
  useEffect(() => {
    if (outcome) scrollResultsIntoView(root.current)
  }, [outcome])
  const failed = run.isError && !isAbort(run.error)
  const rows = [t('landingTry.results.placed'), t('landingTry.results.volume'), t('landingTry.results.balance')]
  const announcement = run.isPending
    ? t('landingTry.announce.running')
    : outcome ? t('landingTry.announce.done', { total: format.integer(outcome.totalCount) }) : ''
  return (
    <div ref={root} className="flex scroll-mt-20 flex-col gap-4" data-try-state={run.isPending ? 'running' : outcome ? 'done' : failed ? 'failed' : 'idle'}>
      <h3 className="m-0 font-display text-h3 leading-5.5 font-[650] text-ink-strong font-stretch-106%">{t('landingTry.results.title')}</h3>
      <p role="status" className="sr-only">{announcement}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {outcome
          ? outcome.plans.map((plan) => <TryPlanCard key={plan.id} outcome={outcome} plan={plan} />)
          : PLAN_OBJECTIVES.map((objective) => <TryPlanPlaceholder key={objective} objective={objective} rows={rows} />)}
      </div>
      {failed ? (
        <Banner tone="danger" role="alert" className="pointer-coarse:text-body-lg">
          {tryErrorLines(run.error, t, format).map((line, index) => <p key={`${index}-${line}`} className="m-0">{line}</p>)}
        </Banner>
      ) : null}
      {!outcome && !failed && !run.isPending ? <p className={TRY_NOTE}>{t('landingTry.results.idle')}</p> : null}
      {outcome ? (
        <>
          <StaleNote control={control} outcome={outcome} />
          {outcome.multiStop ? <StopLegend outcome={outcome} /> : null}
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            <li className={TRY_NOTE}>{t('landingTry.results.source')}</li>
            <li className={TRY_NOTE}>{t('landingTry.results.balanceNote')}</li>
            {outcome.multiStop ? null : <li className={TRY_NOTE}>{t('landingTry.results.singleStopNote')}</li>}
          </ul>
        </>
      ) : null}
      <NextStep />
    </div>
  )
}
