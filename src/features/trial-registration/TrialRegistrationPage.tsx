import { zodResolver } from '@hookform/resolvers/zod'
import { Gift } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { contactPath } from '@/features/marketing/contact-form'
import { PublicFooter } from '@/features/marketing/PublicFooter'
import { PublicHeader } from '@/features/marketing/PublicHeader'
import { usePublicPlansQuery } from '@/features/marketing/useMarketingQuery'
import {
  cleanPhone,
  EMPTY_COMPANY_INFO,
  fieldOfError,
  trialInfoSchema,
  type TrialInfoValues,
} from '@/features/registration/company-info-form'
import { RegistrationLoading } from '@/features/registration/RegistrationLoading'
import { RegistrationOtpForm } from '@/features/registration/RegistrationOtpForm'
import { useOtpCooldown } from '@/features/registration/useOtpCooldown'
import { REGISTRATION_CAPABILITIES } from '@/features/registration/useRegistrationQuery'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { SubscriptionPlan } from '@/lib/mock-db'
import type { GuestTrialInitResponse, GuestTrialVerifyResponse } from './trial-registration-api'
import { TrialInfoStep } from './TrialInfoStep'
import { TrialRejected, TrialSubmitted } from './TrialOutcome'
import {
  useInitGuestTrialMutation,
  useResendGuestTrialOtpMutation,
  useVerifyGuestTrialOtpMutation,
} from './useTrialRegistrationQuery'

type Step = 'info' | 'otp' | 'success' | 'rejected'

/**
 * Đăng ký trải nghiệm `/dang-ky-trai-nghiem` (chỉ khi nối backend): thông tin công ty → OTP qua email → máy chủ kiểm sơ bộ rồi chuyển
 * đội nền tảng duyệt. Kho mẫu không có luồng này (`REGISTRATION_CAPABILITIES`): route chuyển về form liên hệ "Đăng ký tài khoản dùng thử".
 */
export function TrialRegistrationPage() {
  const [params] = useSearchParams()
  if (!REGISTRATION_CAPABILITIES.publicSignUp) {
    return <Navigate replace to={contactPath({ planId: params.get('planId') ?? undefined, type: 'DEMO_REQUEST' })} />
  }
  return <TrialRegistrationForm />
}

function TrialRegistrationForm() {
  const t = useT()
  const pricingQuery = usePublicPlansQuery()
  const initMutation = useInitGuestTrialMutation()
  const verifyOtpMutation = useVerifyGuestTrialOtpMutation()
  const resendOtpMutation = useResendGuestTrialOtpMutation()
  const basicPlan = pricingQuery.data?.find(
    (p: SubscriptionPlan) => p.tier === 'BASIC' || p.name?.toLowerCase().includes('basic'),
  )

  const [step, setStep] = useState<Step>('info')
  const [loading, setLoading] = useState(false)
  const { cooldown, start: startCooldown } = useOtpCooldown()
  const [session, setSession] = useState<GuestTrialInitResponse | null>(null)
  const [result, setResult] = useState<GuestTrialVerifyResponse | null>(null)

  const schema = useMemo(() => trialInfoSchema(t), [t])
  // Biểu mẫu nằm ở cha để giá trị còn nguyên khi quay lại bước thông tin.
  const form = useForm<TrialInfoValues>({ resolver: zodResolver(schema), defaultValues: { ...EMPTY_COMPANY_INFO, note: '' } })

  async function handleInitSubmit(values: TrialInfoValues) {
    setLoading(true)
    try {
      const resp = await initMutation.mutateAsync({
        companyName: values.companyName.trim(),
        taxCode: values.taxCode.trim(),
        companyAddress: values.companyAddress.trim() || undefined,
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phoneCountry: values.phone.country,
        phoneNumber: cleanPhone(values.phone.number) || undefined,
        interestedPlanId: basicPlan?.id ? Number(basicPlan.id) : undefined,
        note: values.note.trim() || undefined,
      })
      setSession(resp)
      setStep('otp')
      startCooldown()
      toast.success(t('trialRegistration.toasts.otpSent'))
    } catch (err) {
      const message = dataErrorMessage(err, t)
      const field = fieldOfError(err)
      if (field) form.setError(field, { message })
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(otp: string) {
    if (!session) return
    setLoading(true)
    try {
      const resp = await verifyOtpMutation.mutateAsync({ token: session.token, otp })
      setResult(resp)
      setStep(resp.status === 'REJECTED' ? 'rejected' : 'success')
    } catch (err) {
      toast.error(dataErrorMessage(err, t))
    } finally {
      setLoading(false)
    }
  }

  async function handleResendOtp() {
    if (!session || cooldown > 0 || loading) return
    setLoading(true)
    try {
      const resp = await resendOtpMutation.mutateAsync({ token: session.token })
      setSession(resp)
      startCooldown()
      toast.success(t('trialRegistration.toasts.otpResent'))
    } catch (err) {
      toast.error(dataErrorMessage(err, t))
    } finally {
      setLoading(false)
    }
  }

  const values = form.getValues()

  return (
    <div className="flex min-h-screen flex-col bg-app text-ink-strong">
      <PublicHeader />

      <main className="flex-1 px-4 py-8 md:py-12">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-caption font-medium text-primary">
              <Gift className="size-3.5" />
              <span>{t('trialRegistration.badge')}</span>
            </div>
            <h1 className="mt-3 font-display text-h1 font-bold text-ink-strong">{t('trialRegistration.title')}</h1>
            <p className="mt-2 text-body text-ink-2">{t('trialRegistration.description')}</p>
          </div>

          <Card className="relative">
            {loading && (
              <RegistrationLoading
                title={step === 'info' ? t('trialRegistration.loading.checkingInfo') : t('trialRegistration.loading.verifyingOtp')}
                description={step === 'info' ? t('trialRegistration.loading.checkingInfoDesc') : t('trialRegistration.loading.verifyingOtpDesc')}
              />
            )}

            {step === 'info' && (
              <TrialInfoStep form={form} loading={loading} planName={basicPlan?.name} onSubmit={(v) => void handleInitSubmit(v)} />
            )}

            {step === 'otp' && (
              <RegistrationOtpForm
                inputId="otp"
                loading={loading}
                cooldown={cooldown}
                onResend={() => void handleResendOtp()}
                onBack={() => setStep('info')}
                onSubmit={(otp) => void handleVerifyOtp(otp)}
                texts={{
                  title: t('trialRegistration.step2.title'),
                  description: t('trialRegistration.step2.description', { email: session?.maskedEmail ?? values.email }),
                  label: t('trialRegistration.step2.otpLabel'),
                  placeholder: t('trialRegistration.step2.otpPlaceholder'),
                  cooldown: t('trialRegistration.step2.cooldown', { seconds: cooldown }),
                  resend: t('trialRegistration.step2.resend'),
                  back: t('trialRegistration.step2.back'),
                  submit: t('trialRegistration.step2.submit'),
                  submitting: t('trialRegistration.step2.submitting'),
                }}
              />
            )}

            {step === 'success' && <TrialSubmitted companyName={values.companyName} taxCode={values.taxCode} email={values.email} />}

            {step === 'rejected' && <TrialRejected reason={result?.aiPrecheckReason ?? undefined} onEdit={() => setStep('info')} />}
          </Card>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
