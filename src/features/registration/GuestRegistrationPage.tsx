import { ArrowLeft, Check, CreditCard, FileText, Mail, RotateCw, Send, ShieldCheck, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Checkbox } from '@/components/ui/Checkbox'
import { Input } from '@/components/ui/Input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup'
import { Spinner } from '@/components/ui/Spinner'
import { PublicFooter } from '@/features/marketing/PublicFooter'
import { PublicHeader } from '@/features/marketing/PublicHeader'
import { PUBLIC_TOUCH } from '@/features/marketing/public-chrome'
import { usePublicPlansQuery } from '@/features/marketing/useMarketingQuery'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { SubscriptionPlan } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import {
  acceptRegistrationPolicy,
  initRegistration,
  initRegistrationPayment,
  resendRegistrationOtp,
  verifyRegistrationOtp,
  type GuestRegistrationSessionResponse,
} from './api/registration-api'

const TAX_CODE_REGEX = /^([0-9]{10}|[0-9]{10}-[0-9]{3}|[0-9]{13})$/
const COMPANY_CODE_REGEX = /^[A-Za-z0-9_-]{3,50}$/

export function GuestRegistrationPage() {
  const t = useT()
  const format = useFormat()
  const [params] = useSearchParams()
  const pricingQuery = usePublicPlansQuery()

  const [currentStep, setCurrentStep] = useState<number>(1)
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Step 1: Info State
  const [companyName, setCompanyName] = useState('')
  const [companyCode, setCompanyCode] = useState('')
  const [taxCode, setTaxCode] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Step 2: OTP State
  const [otp, setOtp] = useState('')
  const [session, setSession] = useState<GuestRegistrationSessionResponse | null>(null)

  // Step 3: Policy State
  const [policyAccepted, setPolicyAccepted] = useState(false)

  // Step 4: Plan & Payment State
  const [selectedPlanId, setSelectedPlanId] = useState<string>(params.get('planId') ?? '')
  const [billingCycle, setBillingCycle] = useState<'1' | '12'>('1')

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Auto-select initial plan from URL or first available plan
  useEffect(() => {
    const urlPlanId = params.get('planId')
    if (urlPlanId) {
      setSelectedPlanId(urlPlanId)
    } else if (pricingQuery.data && pricingQuery.data.length > 0 && !selectedPlanId) {
      const firstPlan = pricingQuery.data[0]
      if (firstPlan) setSelectedPlanId(String(firstPlan.id))
    }
  }, [params, pricingQuery.data, selectedPlanId])

  function validateStep1(): boolean {
    const errs: Record<string, string> = {}
    if (!companyName.trim()) errs.companyName = t('guestRegistration.validation.companyNameRequired')
    if (!companyCode.trim()) {
      errs.companyCode = t('guestRegistration.validation.companyCodeRequired')
    } else if (!COMPANY_CODE_REGEX.test(companyCode.trim())) {
      errs.companyCode = t('guestRegistration.validation.companyCodeInvalid')
    }
    if (!taxCode.trim()) {
      errs.taxCode = t('guestRegistration.validation.taxCodeRequired')
    } else if (!TAX_CODE_REGEX.test(taxCode.trim())) {
      errs.taxCode = t('guestRegistration.validation.taxCodeInvalid')
    }
    if (!fullName.trim()) errs.fullName = t('guestRegistration.validation.fullNameRequired')
    if (!email.trim()) {
      errs.email = t('guestRegistration.validation.emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = t('guestRegistration.validation.emailInvalid')
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleStep1Submit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep1()) return

    setLoading(true)
    try {
      const resp = await initRegistration({
        companyName: companyName.trim(),
        companyCode: companyCode.trim().toUpperCase(),
        taxCode: taxCode.trim(),
        companyAddress: companyAddress.trim() || undefined,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim() || undefined,
      })
      setSession(resp)
      setCurrentStep(2)
      setCooldown(60)
      toast.success(t('guestRegistration.toasts.otpSent'))
    } catch (err) {
      toast.error(dataErrorMessage(err, t))
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2VerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !otp.trim()) return

    setLoading(true)
    try {
      const resp = await verifyRegistrationOtp({
        token: session.token,
        otp: otp.trim(),
      })
      setSession(resp)
      setCurrentStep(3)
      toast.success(t('guestRegistration.toasts.otpSuccess'))
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
      await resendRegistrationOtp(session.token)
      setCooldown(60)
      toast.success(t('guestRegistration.toasts.otpResent'))
    } catch (err) {
      toast.error(dataErrorMessage(err, t))
    } finally {
      setLoading(false)
    }
  }

  async function handleStep3AcceptPolicy(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !policyAccepted) return

    setLoading(true)
    try {
      const resp = await acceptRegistrationPolicy({
        token: session.token,
        accepted: true,
      })
      setSession(resp)
      setCurrentStep(4)
      toast.success(t('guestRegistration.toasts.policyAccepted'))
    } catch (err) {
      toast.error(dataErrorMessage(err, t))
    } finally {
      setLoading(false)
    }
  }

  async function handleStep4Payment(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !selectedPlanId) return

    setLoading(true)
    try {
      const resp = await initRegistrationPayment({
        token: session.token,
        planId: Number(selectedPlanId),
        billingCycleMonths: Number(billingCycle),
      })
      if (resp.paymentUrl) {
        toast.info(t('guestRegistration.toasts.redirectingPayment'))
        window.location.href = resp.paymentUrl
      } else {
        toast.error(t('guestRegistration.toasts.paymentLinkNotFound'))
      }
    } catch (err) {
      toast.error(dataErrorMessage(err, t))
    } finally {
      setLoading(false)
    }
  }

  const selectedPlan = (pricingQuery.data ?? []).find((p: SubscriptionPlan) => String(p.id) === selectedPlanId)
  const basePrice = selectedPlan?.priceVnd ?? 0
  const totalPrice = billingCycle === '12' ? Math.round(basePrice * 12 * 0.85) : basePrice

  return (
    <div className="flex min-h-screen flex-col bg-bg-canvas text-ink-strong">
      <PublicHeader />

      <main className="flex-1 px-4 py-8 md:py-12">
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-caption font-medium text-primary">
              <Zap className="size-3.5" />
              <span>{t('guestRegistration.badge')}</span>
            </div>
            <h1 className="mt-3 text-h1 font-bold text-ink-strong">
              {t('guestRegistration.title')}
            </h1>
            <p className="mt-2 text-body text-ink-2">
              {t('guestRegistration.description')}
            </p>
          </div>

          {/* Stepper Indicator */}
          <div className="mb-8 flex items-center justify-between">
            {[
              { num: 1, label: t('guestRegistration.steps.info') },
              { num: 2, label: t('guestRegistration.steps.otp') },
              { num: 3, label: t('guestRegistration.steps.policy') },
              { num: 4, label: t('guestRegistration.steps.payment') },
            ].map((s, idx) => (
              <div key={s.num} className="flex flex-1 items-center">
                <div className="flex flex-col items-center gap-1.5 flex-none">
                  <div
                    className={cn(
                      'flex size-9 items-center justify-center rounded-full text-caption font-semibold transition-colors',
                      currentStep === s.num
                        ? 'bg-primary text-white ring-4 ring-primary/20'
                        : currentStep > s.num
                          ? 'bg-success text-white'
                          : 'bg-muted text-ink-3',
                    )}
                  >
                    {currentStep > s.num ? <Check className="size-4 stroke-[3]" /> : s.num}
                  </div>
                  <span className={cn('text-caption font-medium', currentStep >= s.num ? 'text-ink-strong' : 'text-ink-3')}>
                    {s.label}
                  </span>
                </div>
                {idx < 3 && (
                  <div
                    className={cn(
                      'mx-2 h-0.5 flex-1 transition-colors',
                      currentStep > s.num ? 'bg-success' : 'bg-line-soft',
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          <Card className="relative overflow-hidden border-border bg-bg shadow-sm">
            {loading && (
              <div
                role="status"
                aria-live="polite"
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-bg/85 backdrop-blur-xs px-6 py-12 text-center animate-[lm-fade-in_180ms_ease-out]"
              >
                <div className="flex size-14 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                  <Spinner className="size-7 border-2 border-cyan-400 border-t-transparent" />
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-body font-semibold text-ink-strong">
                    {currentStep === 1
                      ? t('guestRegistration.loading.checkingInfo')
                      : currentStep === 2
                        ? t('guestRegistration.loading.verifyingOtp')
                        : currentStep === 3
                          ? t('guestRegistration.loading.submittingPolicy')
                          : t('guestRegistration.loading.creatingPayment')}
                  </p>
                  <p className="max-w-sm text-small text-ink-2">
                    {currentStep === 1
                      ? t('guestRegistration.loading.checkingInfoDesc')
                      : currentStep === 2
                        ? t('guestRegistration.loading.verifyingOtpDesc')
                        : currentStep === 3
                          ? t('guestRegistration.loading.submittingPolicyDesc')
                          : t('guestRegistration.loading.creatingPaymentDesc')}
                  </p>
                </div>
              </div>
            )}

            {/* STEP 1: INFO */}
            {currentStep === 1 && (
              <form onSubmit={handleStep1Submit}>
                <CardHeader>
                  <CardTitle as="h2" className="text-h2">{t('guestRegistration.step1.title')}</CardTitle>
                  <p className="text-small text-ink-2">
                    {t('guestRegistration.step1.description')}
                  </p>
                </CardHeader>

                <div className="flex flex-col gap-5 p-6 pt-0">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="companyName" className="text-small font-medium text-ink-strong">
                        {t('guestRegistration.step1.companyName')} <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="companyName"
                        placeholder={t('guestRegistration.step1.companyNamePlaceholder')}
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className={cn(PUBLIC_TOUCH, errors.companyName && 'border-danger')}
                      />
                      {errors.companyName && <span className="text-caption text-danger">{errors.companyName}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="companyCode" className="text-small font-medium text-ink-strong">
                        {t('guestRegistration.step1.companyCode')} <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="companyCode"
                        placeholder={t('guestRegistration.step1.companyCodePlaceholder')}
                        value={companyCode}
                        onChange={(e) => setCompanyCode(e.target.value.toUpperCase())}
                        className={cn(PUBLIC_TOUCH, 'font-mono uppercase', errors.companyCode && 'border-danger')}
                      />
                      {errors.companyCode ? (
                        <span className="text-caption text-danger">{errors.companyCode}</span>
                      ) : (
                        <span className="text-caption text-ink-3">{t('guestRegistration.step1.companyCodeHint')}</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="taxCode" className="text-small font-medium text-ink-strong">
                        {t('guestRegistration.step1.taxCode')} <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="taxCode"
                        placeholder={t('guestRegistration.step1.taxCodePlaceholder')}
                        value={taxCode}
                        onChange={(e) => setTaxCode(e.target.value)}
                        className={cn(PUBLIC_TOUCH, errors.taxCode && 'border-danger')}
                      />
                      {errors.taxCode ? (
                        <span className="text-caption text-danger">{errors.taxCode}</span>
                      ) : (
                        <span className="text-caption text-ink-3">{t('guestRegistration.step1.taxCodeHint')}</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="companyAddress" className="text-small font-medium text-ink-strong">
                        {t('guestRegistration.step1.companyAddress')}
                      </label>
                      <Input
                        id="companyAddress"
                        placeholder={t('guestRegistration.step1.companyAddressPlaceholder')}
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        className={PUBLIC_TOUCH}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="fullName" className="text-small font-medium text-ink-strong">
                        {t('guestRegistration.step1.fullName')} <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="fullName"
                        placeholder={t('guestRegistration.step1.fullNamePlaceholder')}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={cn(PUBLIC_TOUCH, errors.fullName && 'border-danger')}
                      />
                      {errors.fullName && <span className="text-caption text-danger">{errors.fullName}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="email" className="text-small font-medium text-ink-strong">
                        {t('guestRegistration.step1.email')} <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t('guestRegistration.step1.emailPlaceholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={cn(PUBLIC_TOUCH, errors.email && 'border-danger')}
                      />
                      {errors.email && <span className="text-caption text-danger">{errors.email}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="phoneNumber" className="text-small font-medium text-ink-strong">
                        {t('guestRegistration.step1.phoneNumber')}
                      </label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        placeholder={t('guestRegistration.step1.phoneNumberPlaceholder')}
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className={PUBLIC_TOUCH}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
                    <Button asChild variant="ghost">
                      <Link to="/bang-gia">
                        <ArrowLeft className="mr-1.5 size-4" /> {t('guestRegistration.step1.backToPricing')}
                      </Link>
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={loading}
                      disabled={loading}
                      className={cn('min-w-44', PUBLIC_TOUCH)}
                    >
                      {!loading && <Send className="mr-1.5 size-4" />}
                      {loading ? t('guestRegistration.step1.submitting') : t('guestRegistration.step1.submit')}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* STEP 2: OTP */}
            {currentStep === 2 && (
              <form onSubmit={handleStep2VerifyOtp}>
                <CardHeader>
                  <CardTitle as="h2" className="text-h2">{t('guestRegistration.step2.title')}</CardTitle>
                  <p className="text-small text-ink-2">
                    {t('guestRegistration.step2.description', { email: session?.maskedEmail ?? email })}
                  </p>
                </CardHeader>

                <div className="flex flex-col items-center gap-6 p-6 pt-0 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Mail className="size-7" />
                  </div>

                  <div className="w-full max-w-xs flex flex-col gap-2">
                    <Input
                      id="guest-otp"
                      type="text"
                      maxLength={6}
                      autoFocus
                      placeholder={t('guestRegistration.step2.otpPlaceholder')}
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      className={cn('text-center font-mono text-2xl tracking-widest', PUBLIC_TOUCH)}
                    />
                  </div>

                  <div className="text-caption text-ink-2">
                    {cooldown > 0 ? (
                      <span className="text-ink-3">
                        {t('guestRegistration.step2.cooldown', { seconds: cooldown })}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                      >
                        <RotateCw className="size-3.5" /> {t('guestRegistration.step2.resend')}
                      </button>
                    )}
                  </div>

                  <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4 mt-2">
                    <Button type="button" variant="ghost" onClick={() => setCurrentStep(1)} disabled={loading}>
                      <ArrowLeft className="mr-1.5 size-4" /> {t('guestRegistration.step2.backToStep1')}
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={loading}
                      disabled={loading || otp.length < 6}
                      className={cn('min-w-44', PUBLIC_TOUCH)}
                    >
                      {!loading && <ShieldCheck className="mr-1.5 size-4" />}
                      {loading ? t('guestRegistration.step2.submitting') : t('guestRegistration.step2.submit')}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* STEP 3: SAAS AGREEMENT */}
            {currentStep === 3 && (
              <form onSubmit={handleStep3AcceptPolicy}>
                <CardHeader>
                  <CardTitle as="h2" className="text-h2">{t('guestRegistration.step3.title')}</CardTitle>
                  <p className="text-small text-ink-2">
                    {t('guestRegistration.step3.description')}
                  </p>
                </CardHeader>

                <div className="flex flex-col gap-5 p-6 pt-0">
                  <div className="max-h-60 overflow-y-auto rounded-md border border-line-soft bg-muted/30 p-4 text-small text-ink-2 leading-relaxed">
                    <h4 className="font-semibold text-ink-strong mb-2">{t('guestRegistration.step3.agreementTitle')}</h4>
                    <p className="mb-2">{t('guestRegistration.step3.term1')}</p>
                    <p className="mb-2">{t('guestRegistration.step3.term2')}</p>
                    <p className="mb-2">{t('guestRegistration.step3.term3')}</p>
                    <p>{t('guestRegistration.step3.term4')}</p>
                  </div>

                  <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-4">
                    <Checkbox
                      id="policyCheck"
                      checked={policyAccepted}
                      onCheckedChange={(checked) => setPolicyAccepted(Boolean(checked))}
                      className="mt-1"
                    />
                    <label htmlFor="policyCheck" className="text-body cursor-pointer font-normal text-ink-strong">
                      {t('guestRegistration.step3.policyCheckbox', { company: session?.companyName ?? companyName })}
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
                    <Button type="button" variant="ghost" onClick={() => setCurrentStep(2)} disabled={loading}>
                      <ArrowLeft className="mr-1.5 size-4" /> {t('guestRegistration.step3.back')}
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={loading}
                      disabled={!policyAccepted || loading}
                      className={cn('min-w-44', PUBLIC_TOUCH)}
                    >
                      {!loading && <FileText className="mr-1.5 size-4" />}
                      {loading ? t('guestRegistration.step3.submitting') : t('guestRegistration.step3.submit')}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* STEP 4: PLAN & PAYMENT */}
            {currentStep === 4 && (
              <form onSubmit={handleStep4Payment}>
                <CardHeader>
                  <CardTitle as="h2" className="text-h2">{t('guestRegistration.step4.title')}</CardTitle>
                  <p className="text-small text-ink-2">
                    {t('guestRegistration.step4.description')}
                  </p>
                </CardHeader>

                <div className="flex flex-col gap-6 p-6 pt-0">
                  {/* Plan Selection */}
                  <div className="flex flex-col gap-3">
                    <label className="text-body font-semibold text-ink-strong">{t('guestRegistration.step4.choosePlan')}</label>
                    <RadioGroup value={selectedPlanId} onValueChange={setSelectedPlanId} className="grid gap-3 sm:grid-cols-3">
                      {(pricingQuery.data ?? []).map((p: SubscriptionPlan) => (
                        <label
                          key={p.id}
                          htmlFor={`plan-${p.id}`}
                          className={cn(
                            'flex cursor-pointer flex-col justify-between rounded-lg border p-4 transition-all',
                            selectedPlanId === String(p.id)
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                              : 'border-border hover:bg-muted/30',
                          )}
                        >
                          <div>
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-ink-strong">{p.name}</span>
                              <RadioGroupItem value={String(p.id)} id={`plan-${p.id}`} />
                            </div>
                            <div className="mt-2 text-h3 font-bold text-primary">
                              {format.currency(p.priceVnd)}
                              <span className="text-caption font-normal text-ink-2">{t('guestRegistration.step4.perMonth')}</span>
                            </div>
                          </div>
                          <div className="mt-3 border-t border-border/50 pt-2 text-caption text-ink-2">
                            {p.monthlyCredits ? t('guestRegistration.step4.creditsPerMonth', { count: p.monthlyCredits }) : t('guestRegistration.step4.unlimitedCredits')}
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Billing Cycle */}
                  <div className="flex flex-col gap-3">
                    <label className="text-body font-semibold text-ink-strong">{t('guestRegistration.step4.billingCycle')}</label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant={billingCycle === '1' ? 'primary' : 'secondary'}
                        onClick={() => setBillingCycle('1')}
                        className="h-12"
                      >
                        {t('guestRegistration.step4.oneMonth')}
                      </Button>
                      <Button
                        type="button"
                        variant={billingCycle === '12' ? 'primary' : 'secondary'}
                        onClick={() => setBillingCycle('12')}
                        className="h-12 relative"
                      >
                        {t('guestRegistration.step4.oneYear')}
                        <span className="ml-2 rounded-full bg-warning px-2 py-0.5 text-[11px] font-bold text-slate-900">
                          {t('guestRegistration.step4.savePercent')}
                        </span>
                      </Button>
                    </div>
                  </div>

                  {/* Summary & Price */}
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-baseline justify-between border-b border-border/50 pb-2">
                      <span className="text-body text-ink-2">{t('guestRegistration.step4.selectedPlanLabel')}</span>
                      <strong className="text-body text-ink-strong">{selectedPlan?.name ?? '—'}</strong>
                    </div>
                    <div className="flex items-baseline justify-between pt-3">
                      <span className="text-h3 font-bold text-ink-strong">{t('guestRegistration.step4.totalAmountLabel')}</span>
                      <span className="text-h2 font-extrabold text-primary tabular-nums">
                        {format.currency(totalPrice)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
                    <Button type="button" variant="ghost" onClick={() => setCurrentStep(3)} disabled={loading}>
                      <ArrowLeft className="mr-1.5 size-4" /> {t('guestRegistration.step4.backToStep3')}
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={loading}
                      disabled={loading || !selectedPlanId}
                      className={cn('min-w-56 font-bold', PUBLIC_TOUCH)}
                    >
                      {!loading && <CreditCard className="mr-2 size-5" />}
                      {loading ? t('guestRegistration.step4.submitting') : t('guestRegistration.step4.payVnPay')}
                    </Button>
                  </div>
                </div>
              </form>
            )}
          </Card>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
