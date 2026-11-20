import { ArrowLeft } from 'lucide-react'
import { useCallback, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Logo } from '@/components/brand/Logo'
import { LogoMark } from '@/components/brand/LogoMark'
import { LanguageMenu } from '@/components/LanguageMenu'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { PUBLIC_HOME, PUBLIC_SAMPLE_PLAN, TRIAL_REGISTRATION } from '@/features/auth/landing'
import { REGISTRATION_CAPABILITIES } from '@/features/registration/useRegistrationQuery'
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CONTACT_ANCHOR } from '../contact-form'
import { landingPlans } from '../landing-plans'
import { LANDING_REQUEST, LANDING_STOP_COUNT } from '../landing-sample.mock'
import { PUBLIC_TOUCH } from '../public-chrome'
import { useLandingSample } from '../useLandingSample'
import { readSampleState, sampleSearch, withSampleState, type SamplePlanState } from './sample-plan-url'
import { SamplePlanPanel } from './SamplePlanPanel'
import { SamplePlanStage } from './SamplePlanStage'
import { ShareLink } from './ShareLink'

const PACKAGE_COUNT = LANDING_REQUEST.packages.reduce((count, line) => count + line.quantity, 0)

/** Nút chính duy nhất của trang, như phần mở đầu trang giới thiệu: khách tự đăng ký được thì "Đăng ký trải nghiệm", không thì "Nhận tư vấn". */
function SampleCta({ className }: { className?: string }) {
  const t = useT()
  const user = useAuthSafe()?.user
  const signUp = REGISTRATION_CAPABILITIES.publicSignUp && !user
  return (
    <Button asChild variant="primary" className={cn(PUBLIC_TOUCH, SKY_FOCUS, className)}>
      {signUp
        ? <Link to={TRIAL_REGISTRATION}>{t('landing.header.trial')}</Link>
        : <Link to={{ pathname: PUBLIC_HOME, hash: `#${CONTACT_ANCHOR}` }}>{t('landing.hero.cta')}</Link>}
    </Button>
  )
}

/**
 * Trang công khai "Phương án mẫu" `/phuong-an-mau` (ngoài `RequireAuth`): chuyến mẫu 366 kiện, bốn điểm giao của trang giới thiệu — cùng
 * lần chạy của bộ tối ưu mô phỏng trên trình duyệt (`useLandingSample`) — trong một khung 3D xoay được gần kín màn hình. Chọn phương án
 * A · B · C, xem xếp theo thứ tự xếp hay dỡ ở từng điểm, phát / dừng / từng bước (Space · ← · → · Home), bốn góc nhìn. Trạng thái nằm
 * trên URL (`sample-plan-url.ts`) nên "Sao chép liên kết" mở lại đúng cảnh. Không MOCK RESULT: một câu nói số từ đâu ra. Lối ra là logo
 * kèm mũi tên về trang giới thiệu. Từ 1.024 px khung 3D chiếm phần trái, cột số bên phải tự cuộn; hẹp hơn thì khung ở trên, cột ở dưới.
 */
export function SamplePlanPage() {
  const t = useT()
  const format = useFormat()
  const reducedMotion = usePrefersReducedMotion()
  const [search, setSearch] = useSearchParams()
  const state = useMemo(() => readSampleState(search), [search])
  const update = useCallback((patch: Partial<SamplePlanState>) => {
    setSearch((current) => withSampleState(current, { ...readSampleState(current), ...patch }), { replace: true })
  }, [setSearch])
  const sample = useLandingSample(true)
  const plans = useMemo(() => (sample.data ? landingPlans(LANDING_REQUEST, sample.data) : null), [sample.data])
  const plan = plans?.find((candidate) => candidate.id === state.plan)
  const stopNames = useMemo(
    () => [t('landing.sample.stop1'), t('landing.sample.stop2'), t('landing.sample.stop3'), t('landing.sample.stop4')],
    [t],
  )
  const shareUrl = typeof window === 'undefined' ? '' : `${window.location.origin}${PUBLIC_SAMPLE_PLAN}?${sampleSearch(state)}`

  return (
    <div className="relative flex min-h-dvh flex-col bg-canvas-1 lg:h-dvh lg:overflow-hidden">
      <header className="sky flex flex-none items-center gap-3 px-4 py-2 md:px-shell pointer-coarse:py-3">
        <Link to={PUBLIC_HOME} aria-label={t('samplePlan.backLabel')}
          className="flex min-h-12 flex-none items-center gap-2 rounded-md px-1 text-sky-text-2 outline-none hover:text-sky-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 pointer-coarse:min-h-14">
          <ArrowLeft aria-hidden strokeWidth={1.5} className="size-5" />
          <LogoMark tone="dark" className="sm:hidden" />
          <Logo tone="dark" size="sm" decorative className="hidden sm:inline-flex" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="m-0 font-display text-h2 leading-tight font-bold text-sky-text font-stretch-112% sm:text-h1">{t('samplePlan.title')}</h1>
          <p className="m-0 hidden text-small text-sky-text-3 md:block">
            {t('samplePlan.lede', { count: format.integer(PACKAGE_COUNT), stops: format.integer(LANDING_STOP_COUNT) })}
          </p>
        </div>
        <LanguageSwitch tone="sky" className="hidden flex-none sm:flex pointer-coarse:[&_button]:size-14 pointer-coarse:[&_button]:text-body-lg" />
        <LanguageMenu className="h-10 min-w-10 flex-none sm:hidden pointer-coarse:h-14 pointer-coarse:min-w-14 pointer-coarse:text-body-lg" itemClassName={PUBLIC_TOUCH} />
        <SampleCta className="hidden flex-none sm:inline-flex" />
      </header>

      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <section aria-label={t('samplePlan.stageLabel', { label: state.plan })}
          className="relative h-[68svh] min-h-[26rem] flex-none border-b border-border-dark lg:h-auto lg:min-h-0 lg:flex-1 lg:border-r lg:border-b-0">
          <SamplePlanStage state={state} result={plan?.result} failed={sample.isError} autoplay={!reducedMotion} stopNames={stopNames}
            label={t('samplePlan.stageLabel', { label: state.plan })} onView={(view) => update({ view })} />
        </section>
        <aside className="relative flex-none bg-canvas-2 px-4 py-4 lg:w-[26rem] lg:overflow-y-auto xl:w-[28rem]">
          <SamplePlanPanel state={state} plans={plans} stopNames={stopNames} onChange={update}>
            <p className="m-0 text-small text-sky-text-3 pointer-coarse:text-body-lg">{t('samplePlan.source')}</p>
            {shareUrl ? <ShareLink url={shareUrl} /> : null}
            <SampleCta className="self-start sm:hidden" />
          </SamplePlanPanel>
        </aside>
      </main>
    </div>
  )
}
