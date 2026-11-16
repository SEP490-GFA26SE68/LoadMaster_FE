import { zodResolver } from '@hookform/resolvers/zod'
import { Zap } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Card } from '@/components/ui/Card'
import { REGISTRATION_SUCCESS } from '@/features/auth/landing'
import { contactPath } from '@/features/marketing/contact-form'
import { PublicFooter } from '@/features/marketing/PublicFooter'
import { PublicHeader } from '@/features/marketing/PublicHeader'
import { usePublicPlansQuery } from '@/features/marketing/useMarketingQuery'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { cleanPhone, EMPTY_COMPANY_INFO, fieldOfError, guestInfoSchema, type GuestInfoValues } from './company-info-form'
import { GuestInfoStep } from './GuestInfoStep'
import { GuestPaymentStep } from './GuestPaymentStep'
import { GuestPolicyStep } from './GuestPolicyStep'
import { paymentSchema, resolveNumericPlanId, type PaymentValues } from './payment-form'
import type { GuestRegistrationSessionResponse } from './registration-api'
import { RegistrationLoading } from './RegistrationLoading'
import { RegistrationOtpForm } from './RegistrationOtpForm'
import { RegistrationStepper } from './RegistrationStepper'
import { useOtpCooldown } from './useOtpCooldown'
import {
  REGISTRATION_CAPABILITIES,
  useAcceptRegistrationPolicyMutation,
  useInitRegistrationMutation,
  useInitRegistrationPaymentMutation,
  useMockRegistrationCheckoutMutation,
  useResendRegistrationOtpMutation,
  useVerifyRegistrationOtpMutation,
} from './useRegistrationQuery'

/** Khoá câu của lớp chờ theo bước 1 → 4. */
const LOADING_KEYS = ['checkingInfo', 'verifyingOtp', 'submittingPolicy', 'creatingPayment'] as const

/**
 * Tự đăng ký trả phí `/dang-ky` (chỉ khi nối backend): thông tin công ty → OTP qua email → điều khoản → chọn gói và thanh toán → tạo
 * tài khoản. Kho mẫu không có luồng này (`REGISTRATION_CAPABILITIES`): route chuyển về form liên hệ báo giá, giữ gói đã chọn.
 */
export function GuestRegistrationPage() {
  const [params] = useSearchParams()
  if (!REGISTRATION_CAPABILITIES.publicSignUp) {
    return <Navigate replace to={contactPath({ planId: params.get('planId') ?? undefined, type: 'PRICING' })} />
  }
  return <GuestRegistrationWizard />
}

function GuestRegistrationWizard() {
  const t = useT()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const pricingQuery = usePublicPlansQuery()
  const initMutation = useInitRegistrationMutation()
  const verifyOtpMutation = useVerifyRegistrationOtpMutation()
  const resendOtpMutation = useResendRegistrationOtpMutation()
  const acceptPolicyMutation = useAcceptRegistrationPolicyMutation()
  const paymentMutation = useInitRegistrationPaymentMutation()
  const mockCheckoutMutation = useMockRegistrationCheckoutMutation()

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const { cooldown, start: startCooldown } = useOtpCooldown()
  const [session, setSession] = useState<GuestRegistrationSessionResponse | null>(null)

  // Hai biểu mẫu nằm ở cha để giá trị còn nguyên khi đi lùi giữa các bước.
  const infoSchema = useMemo(() => guestInfoSchema(t), [t])
  const infoForm = useForm<GuestInfoValues>({ resolver: zodResolver(infoSchema), defaultValues: { ...EMPTY_COMPANY_INFO, companyCode: '' } })
  const paymentForm = useForm<PaymentValues>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { planId: params.get('planId') ?? '', billingCycle: 'MONTHLY' },
  })
  const plans = pricingQuery.data ?? []

  // Chưa chọn gói qua URL thì chọn sẵn gói đầu tiên khi danh mục về.
  const firstPlanId = plans[0]?.id
  useEffect(() => {
    if (firstPlanId !== undefined && paymentForm.getValues('planId') === '') paymentForm.setValue('planId', String(firstPlanId))
  }, [firstPlanId, paymentForm])

  /** Chạy một lượt gọi máy chủ dưới lớp chờ; lỗi thành toast, lỗi nói tới một ô thì gắn vào ô đó. */
  async function run(action: () => Promise<void>) {
    setLoading(true)
    try {
      await action()
    } catch (err) {
      const message = dataErrorMessage(err, t)
      const field = fieldOfError(err)
      if (field) infoForm.setError(field, { message })
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  const handleInfo = (values: GuestInfoValues) =>
    run(async () => {
      const resp = await initMutation.mutateAsync({
        companyName: values.companyName.trim(),
        companyCode: values.companyCode.trim().toUpperCase(),
        taxCode: values.taxCode.trim(),
        companyAddress: values.companyAddress.trim() || undefined,
        fullName: values.fullName.trim(),
        email: values.email.trim().toLowerCase(),
        phoneCountry: values.phone.country,
        phoneNumber: cleanPhone(values.phone.number),
      })
      setSession(resp)
      setCurrentStep(2)
      startCooldown()
      toast.success(t('guestRegistration.toasts.otpSent'))
    })

  const handleVerifyOtp = (otp: string) =>
    run(async () => {
      if (!session) return
      setSession(await verifyOtpMutation.mutateAsync({ token: session.token, otp }))
      setCurrentStep(3)
      toast.success(t('guestRegistration.toasts.otpSuccess'))
    })

  const handleResendOtp = () => {
    if (!session || cooldown > 0 || loading) return
    void run(async () => {
      await resendOtpMutation.mutateAsync(session.token)
      startCooldown()
      toast.success(t('guestRegistration.toasts.otpResent'))
    })
  }

  const handleAcceptPolicy = () =>
    run(async () => {
      if (!session) return
      setSession(await acceptPolicyMutation.mutateAsync({ token: session.token, accepted: true }))
      setCurrentStep(4)
      toast.success(t('guestRegistration.toasts.policyAccepted'))
    })

  const handlePayment = (values: PaymentValues) =>
    run(async () => {
      if (!session) return
      const resp = await paymentMutation.mutateAsync({
        token: session.token,
        planId: resolveNumericPlanId(values.planId),
        billingCycle: values.billingCycle,
      })
      if (!resp.paymentUrl) {
        toast.error(t('guestRegistration.toasts.paymentLinkNotFound'))
        return
      }
      if (!resp.paymentUrl.includes('/api/payment/mock-checkout')) {
        toast.info(t('guestRegistration.toasts.redirectingPayment'))
        window.location.href = resp.paymentUrl
        return
      }
      const txnRef = resp.paymentRef || new URL(resp.paymentUrl, window.location.origin).searchParams.get('txnRef') || ''
      const checkout = await mockCheckoutMutation.mutateAsync(txnRef)
      if (checkout?.callbackResult?.RspCode === '00') {
        toast.info(t('guestRegistration.toasts.redirectingPayment'))
        void navigate(`${REGISTRATION_SUCCESS}?orderCode=${encodeURIComponent(txnRef)}`)
      } else {
        toast.error(t('guestRegistration.toasts.paymentFailed'))
      }
    })

  const loadingKey = LOADING_KEYS[currentStep - 1] ?? 'creatingPayment'
  const info = infoForm.getValues()

  return (
    <div className="flex min-h-screen flex-col bg-app text-ink-strong">
      <PublicHeader />

      <main className="flex-1 px-4 py-8 md:py-12">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-caption font-medium text-primary">
              <Zap className="size-3.5" />
              <span>{t('guestRegistration.badge')}</span>
            </div>
            <h1 className="mt-3 font-display text-h1 font-bold text-ink-strong">{t('guestRegistration.title')}</h1>
            <p className="mt-2 text-body text-ink-2">{t('guestRegistration.description')}</p>
          </div>

          <RegistrationStepper
            current={currentStep}
            labels={[
              t('guestRegistration.steps.info'),
              t('guestRegistration.steps.otp'),
              t('guestRegistration.steps.policy'),
              t('guestRegistration.steps.payment'),
            ]}
          />

          <Card className="relative overflow-hidden border-border bg-bg shadow-sm">
            {loading && (
              <RegistrationLoading
                title={t(`guestRegistration.loading.${loadingKey}`)}
                description={t(`guestRegistration.loading.${loadingKey}Desc`)}
              />
            )}

            {currentStep === 1 && <GuestInfoStep form={infoForm} loading={loading} onSubmit={(v) => void handleInfo(v)} />}

            {currentStep === 2 && (
              <RegistrationOtpForm
                inputId="guest-otp"
                loading={loading}
                cooldown={cooldown}
                onResend={handleResendOtp}
                onBack={() => setCurrentStep(1)}
                onSubmit={(otp) => void handleVerifyOtp(otp)}
                texts={{
                  title: t('guestRegistration.step2.title'),
                  description: t('guestRegistration.step2.description', { email: session?.maskedEmail ?? info.email }),
                  placeholder: t('guestRegistration.step2.otpPlaceholder'),
                  cooldown: t('guestRegistration.step2.cooldown', { seconds: cooldown }),
                  resend: t('guestRegistration.step2.resend'),
                  back: t('guestRegistration.step2.backToStep1'),
                  submit: t('guestRegistration.step2.submit'),
                  submitting: t('guestRegistration.step2.submitting'),
                }}
              />
            )}

            {currentStep === 3 && (
              <GuestPolicyStep
                companyName={session?.companyName ?? info.companyName}
                loading={loading}
                onBack={() => setCurrentStep(2)}
                onSubmit={() => void handleAcceptPolicy()}
              />
            )}

            {currentStep === 4 && (
              <GuestPaymentStep
                form={paymentForm}
                plans={plans}
                loading={loading}
                onBack={() => setCurrentStep(3)}
                onSubmit={(v) => void handlePayment(v)}
              />
            )}
          </Card>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
