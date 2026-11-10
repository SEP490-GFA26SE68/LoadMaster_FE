import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Gift, Mail, RotateCw, Send, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { isPhoneValidForCountry, PhoneInput, type PhoneCountryCode } from '@/components/ui/PhoneInput'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { PublicFooter } from '@/features/marketing/PublicFooter'
import { PublicHeader } from '@/features/marketing/PublicHeader'
import { PUBLIC_TOUCH } from '@/features/marketing/public-chrome'
import { usePublicPlansQuery } from '@/features/marketing/useMarketingQuery'
import { isApiError } from '@/lib/api-client'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { SubscriptionPlan } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import {
  initGuestTrial,
  resendGuestTrialOtp,
  verifyGuestTrialOtp,
  type GuestTrialInitResponse,
  type GuestTrialVerifyResponse,
} from './trial-registration-api'

type Step = 'info' | 'otp' | 'success' | 'rejected'

const TAX_CODE_REGEX = /^([0-9]{10}|[0-9]{10}-[0-9]{3}|[0-9]{13})$/

export function TrialRegistrationPage() {
  const t = useT()
  const pricingQuery = usePublicPlansQuery()
  const basicPlan = pricingQuery.data?.find(
    (p: SubscriptionPlan) => p.tier === 'BASIC' || p.name?.toLowerCase().includes('basic'),
  )

  const [step, setStep] = useState<Step>('info')
  const [loading, setLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // Step 1 State
  const [companyName, setCompanyName] = useState('')
  const [taxCode, setTaxCode] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneCountry, setPhoneCountry] = useState<PhoneCountryCode>('VN')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Step 2 State
  const [otp, setOtp] = useState('')
  const [session, setSession] = useState<GuestTrialInitResponse | null>(null)
  const [result, setResult] = useState<GuestTrialVerifyResponse | null>(null)

  // OTP cooldown ticker
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  function validateStep1(): boolean {
    const newErrors: Record<string, string> = {}
    if (!companyName.trim()) newErrors.companyName = t('trialRegistration.validation.companyNameRequired')
    if (!taxCode.trim()) {
      newErrors.taxCode = t('trialRegistration.validation.taxCodeRequired')
    } else if (!TAX_CODE_REGEX.test(taxCode.trim())) {
      newErrors.taxCode = t('trialRegistration.validation.taxCodeInvalid')
    }
    if (!fullName.trim()) newErrors.fullName = t('trialRegistration.validation.fullNameRequired')
    if (!email.trim()) {
      newErrors.email = t('trialRegistration.validation.emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = t('trialRegistration.validation.emailInvalid')
    }
    const cleanedPhone = phoneNumber.replace(/[\s.-]/g, '')
    if (!cleanedPhone) {
      newErrors.phoneNumber = t('guestRegistration.validation.phoneRequired')
    } else if (!isPhoneValidForCountry(cleanedPhone, phoneCountry)) {
      newErrors.phoneNumber =
        phoneCountry === 'VN'
          ? t('guestRegistration.validation.phoneInvalidVN')
          : t('guestRegistration.validation.phoneInvalidCountry')
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleInitSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateStep1()) return

    setLoading(true)
    try {
      const resp = await initGuestTrial({
        companyName: companyName.trim(),
        taxCode: taxCode.trim(),
        companyAddress: companyAddress.trim() || undefined,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phoneCountry,
        phoneNumber: phoneNumber.replace(/[\s.-]/g, '') || undefined,
        interestedPlanId: basicPlan?.id ? Number(basicPlan.id) : undefined,
        note: note.trim() || undefined,
      })
      setSession(resp)
      setStep('otp')
      setCooldown(60)
      toast.success(resp.message)
    } catch (err) {
      const translated = dataErrorMessage(err, t)
      if (isApiError(err)) {
        const code = err.code ?? ''
        if (code.includes('TAX_CODE') || translated.includes('Mã số thuế')) {
          setErrors((prev) => ({ ...prev, taxCode: translated }))
        } else if (code.includes('EMAIL') || code === 'USER_ALREADY_EXISTS' || translated.includes('Email')) {
          setErrors((prev) => ({ ...prev, email: translated }))
        } else if (code.includes('PHONE') || translated.includes('Số điện thoại')) {
          setErrors((prev) => ({ ...prev, phoneNumber: translated }))
        }
      }
      toast.error(translated)
    } finally {
      setLoading(false)
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!session || !otp.trim()) return

    setLoading(true)
    try {
      const resp = await verifyGuestTrialOtp({
        token: session.token,
        otp: otp.trim(),
      })
      setResult(resp)
      if (resp.status === 'REJECTED') {
        setStep('rejected')
      } else {
        setStep('success')
      }
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
      const resp = await resendGuestTrialOtp({ token: session.token })
      setSession(resp)
      setCooldown(60)
      toast.success(resp.message)
    } catch (err) {
      toast.error(dataErrorMessage(err, t))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-canvas text-ink-strong">
      <PublicHeader />

      <main className="flex-1 px-4 py-8 md:py-12">
        <div className="mx-auto max-w-2xl">
          {/* Header Card */}
          <div className="mb-8 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-caption font-medium text-cyan-400">
              <Gift className="size-3.5" />
              <span>{t('trialRegistration.badge')}</span>
            </div>
            <h1 className="mt-3 text-h1 font-bold text-ink-strong">
              {t('trialRegistration.title')}
            </h1>
            <p className="mt-2 text-body text-ink-2">
              {t('trialRegistration.description')}
            </p>
          </div>

          <Card className="relative border-border bg-bg shadow-sm">
            {loading && (
              <div
                role="status"
                aria-live="polite"
                className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 rounded-[inherit] bg-bg/85 backdrop-blur-xs px-6 py-12 text-center animate-[lm-fade-in_180ms_ease-out]"
              >
                <div className="flex size-14 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
                  <Spinner className="size-7 border-2 border-cyan-400 border-t-transparent" />
                </div>
                <div className="flex flex-col items-center gap-1.5">
                  <p className="text-body font-semibold text-ink-strong">
                    {step === 'info'
                      ? t('trialRegistration.loading.checkingInfo')
                      : t('trialRegistration.loading.verifyingOtp')}
                  </p>
                  <p className="max-w-sm text-small text-ink-2">
                    {step === 'info'
                      ? t('trialRegistration.loading.checkingInfoDesc')
                      : t('trialRegistration.loading.verifyingOtpDesc')}
                  </p>
                </div>
              </div>
            )}

            {step === 'info' && (
              <form onSubmit={handleInitSubmit}>
                <CardHeader>
                  <CardTitle as="h2" className="text-h2">{t('trialRegistration.step1.title')}</CardTitle>
                  <p className="text-small text-ink-2">
                    {t('trialRegistration.step1.description')}
                  </p>
                </CardHeader>

                <div className="flex flex-col gap-5 p-6 pt-0">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="companyName" className="text-small font-medium text-ink-strong">
                        {t('trialRegistration.step1.companyName')} <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="companyName"
                        placeholder={t('trialRegistration.step1.companyNamePlaceholder')}
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        disabled={loading}
                        className={cn(PUBLIC_TOUCH, errors.companyName && 'border-danger')}
                      />
                      {errors.companyName && <span className="text-caption text-danger">{errors.companyName}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="taxCode" className="text-small font-medium text-ink-strong">
                        {t('trialRegistration.step1.taxCode')} <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="taxCode"
                        inputMode="numeric"
                        placeholder={t('trialRegistration.step1.taxCodePlaceholder')}
                        value={taxCode}
                        onChange={(e) => {
                          setTaxCode(e.target.value.replace(/[^0-9-]/g, ''))
                          setErrors((prev) => {
                            const next = { ...prev }
                            delete next.taxCode
                            return next
                          })
                        }}
                        disabled={loading}
                        className={cn(PUBLIC_TOUCH, errors.taxCode && 'border-danger')}
                      />
                      {errors.taxCode ? (
                        <span className="text-caption text-danger">{errors.taxCode}</span>
                      ) : (
                        <span className="text-caption text-ink-3">{t('trialRegistration.step1.taxCodeHint')}</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <span className="text-small font-medium text-ink-strong">
                        {t('trialRegistration.step1.interestedPlan')}
                      </span>
                      <div className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-bg-muted px-3 py-2 text-small">
                        <span className="font-semibold text-ink-strong">
                          {basicPlan?.name ?? t('trialRegistration.step1.fixedPlanName')}
                        </span>
                        <span className="rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-caption font-medium text-cyan-500">
                          {t('trialRegistration.step1.fixedPlanBadge')}
                        </span>
                      </div>
                      <span className="text-caption text-ink-3">
                        {t('trialRegistration.step1.fixedPlanHint')}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="companyAddress" className="text-small font-medium text-ink-strong">
                        {t('trialRegistration.step1.companyAddress')}
                      </label>
                      <Input
                        id="companyAddress"
                        placeholder={t('trialRegistration.step1.companyAddressPlaceholder')}
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        disabled={loading}
                        className={PUBLIC_TOUCH}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="fullName" className="text-small font-medium text-ink-strong">
                        {t('trialRegistration.step1.fullName')} <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="fullName"
                        placeholder={t('trialRegistration.step1.fullNamePlaceholder')}
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        disabled={loading}
                        className={cn(PUBLIC_TOUCH, errors.fullName && 'border-danger')}
                      />
                      {errors.fullName && <span className="text-caption text-danger">{errors.fullName}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="email" className="text-small font-medium text-ink-strong">
                        {t('trialRegistration.step1.email')} <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="email"
                        type="email"
                        placeholder={t('trialRegistration.step1.emailPlaceholder')}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={loading}
                        className={cn(PUBLIC_TOUCH, errors.email && 'border-danger')}
                      />
                      {errors.email ? (
                        <span className="text-caption text-danger">{errors.email}</span>
                      ) : (
                        <span className="text-caption text-ink-3">{t('trialRegistration.step1.emailHint')}</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="phoneNumber" className="text-small font-medium text-ink-strong">
                        {t('trialRegistration.step1.phoneNumber')} <span className="text-danger">*</span>
                      </label>
                      <PhoneInput
                        id="phoneNumber"
                        country={phoneCountry}
                        onCountryChange={(c) => {
                          setPhoneCountry(c)
                          setErrors((prev) => {
                            const next = { ...prev }
                            delete next.phoneNumber
                            return next
                          })
                        }}
                        value={phoneNumber}
                        onChange={(val) => {
                          setPhoneNumber(val)
                          setErrors((prev) => {
                            const next = { ...prev }
                            delete next.phoneNumber
                            return next
                          })
                        }}
                        disabled={loading}
                        invalid={Boolean(errors.phoneNumber)}
                        className={PUBLIC_TOUCH}
                      />
                      {errors.phoneNumber && <span className="text-caption text-danger">{errors.phoneNumber}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="note" className="text-small font-medium text-ink-strong">
                        {t('trialRegistration.step1.note')}
                      </label>
                      <Textarea
                        id="note"
                        placeholder={t('trialRegistration.step1.notePlaceholder')}
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        disabled={loading}
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button asChild variant="ghost">
                      <Link to="/bang-gia">
                        <ArrowLeft className="mr-1.5 size-4" /> {t('trialRegistration.step1.backToPricing')}
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
                      {loading ? t('trialRegistration.step1.submitting') : t('trialRegistration.step1.submit')}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp}>
                <CardHeader>
                  <CardTitle as="h2" className="text-h2">{t('trialRegistration.step2.title')}</CardTitle>
                  <p className="text-small text-ink-2">
                    {t('trialRegistration.step2.description', { email: session?.maskedEmail ?? email })}
                  </p>
                </CardHeader>

                <div className="flex flex-col gap-6 p-6 pt-0">
                  <div className="flex flex-col items-center gap-4 py-4 text-center">
                    <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Mail className="size-7" />
                    </div>

                    <div className="w-full max-w-xs flex flex-col gap-2">
                      <label htmlFor="otp" className="sr-only">{t('trialRegistration.step2.otpLabel')}</label>
                      <Input
                        id="otp"
                        type="text"
                        maxLength={6}
                        autoFocus
                        placeholder={t('trialRegistration.step2.otpPlaceholder')}
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                        disabled={loading}
                        className={cn('text-center font-mono text-2xl tracking-widest', PUBLIC_TOUCH)}
                      />
                    </div>

                    <div className="text-caption text-ink-2">
                      {cooldown > 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-ink-3">
                          <Clock className="size-3.5" /> {t('trialRegistration.step2.cooldown', { seconds: cooldown })}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={loading}
                          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                        >
                          <RotateCw className="size-3.5" /> {t('trialRegistration.step2.resend')}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
                    <Button type="button" variant="ghost" onClick={() => setStep('info')} disabled={loading}>
                      <ArrowLeft className="mr-1.5 size-4" /> {t('trialRegistration.step2.back')}
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      loading={loading}
                      disabled={loading || otp.length < 6}
                      className={cn('min-w-44', PUBLIC_TOUCH)}
                    >
                      {!loading && <ShieldCheck className="mr-1.5 size-4" />}
                      {loading ? t('trialRegistration.step2.submitting') : t('trialRegistration.step2.submit')}
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {step === 'success' && (
              <div className="flex flex-col items-center p-8 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-success/10 text-success">
                  <CheckCircle2 className="size-10" />
                </div>
                <h2 className="mt-4 text-h2 font-bold text-ink-strong">
                  {t('trialRegistration.success.title')}
                </h2>
                <p className="mt-2 max-w-md text-body text-ink-2">
                  {t('trialRegistration.success.description')}
                </p>

                <div className="mt-6 w-full max-w-lg rounded-lg border border-primary/20 bg-primary/5 p-4 text-left">
                  <div className="flex flex-col gap-1 text-small text-ink-strong">
                    <strong>{t('trialRegistration.success.receivedInfo')}</strong>
                    <span>{t('trialRegistration.success.company', { name: companyName })}</span>
                    <span>{t('trialRegistration.success.taxCode', { code: taxCode })}</span>
                    <span>{t('trialRegistration.success.email', { email })}</span>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3 justify-center">
                  <Button asChild variant="primary">
                    <Link to="/gioi-thieu">{t('trialRegistration.success.backHome')}</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link to="/dang-nhap">{t('trialRegistration.success.toLogin')}</Link>
                  </Button>
                </div>
              </div>
            )}

            {step === 'rejected' && (
              <div className="flex flex-col items-center p-8 text-center">
                <div className="flex size-16 items-center justify-center rounded-full bg-danger/10 text-danger">
                  <AlertCircle className="size-10" />
                </div>
                <h2 className="mt-4 text-h2 font-bold text-ink-strong">
                  {t('trialRegistration.rejected.title')}
                </h2>
                <p className="mt-2 max-w-md text-body text-ink-2">
                  {t('trialRegistration.rejected.description')}
                </p>

                <div className="mt-6 w-full max-w-lg rounded-lg border border-danger/20 bg-danger/5 p-4 text-left">
                  <div className="flex flex-col gap-1 text-small text-danger">
                    <strong>{t('trialRegistration.rejected.reasonHeader')}</strong>
                    <span>{result?.aiPrecheckReason ?? t('trialRegistration.rejected.defaultReason')}</span>
                  </div>
                </div>

                <p className="mt-4 text-caption text-ink-3 max-w-md">
                  {t('trialRegistration.rejected.emailNote')}
                </p>

                <div className="mt-8 flex flex-wrap gap-3 justify-center">
                  <Button type="button" variant="secondary" onClick={() => setStep('info')}>
                    {t('trialRegistration.rejected.editInfo')}
                  </Button>
                  <Button asChild variant="primary">
                    <Link to="/gioi-thieu#lien-he">{t('trialRegistration.rejected.contactSupport')}</Link>
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>

      <PublicFooter />
    </div>
  )
}
