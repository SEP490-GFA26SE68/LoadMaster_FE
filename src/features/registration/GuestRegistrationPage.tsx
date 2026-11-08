import { ArrowLeft, Check, CreditCard, FileText, Mail, RotateCw, ShieldCheck, Zap } from 'lucide-react'
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

type WizardStep = 1 | 2 | 3 | 4

const TAX_CODE_REGEX = /^([0-9]{10}|[0-9]{10}-[0-9]{3}|[0-9]{13})$/

export function GuestRegistrationPage() {
  const t = useT()
  const format = useFormat()
  const [params] = useSearchParams()
  const pricingQuery = usePublicPlansQuery()

  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [loading, setLoading] = useState(false)

  // Step 1: Info State
  const [companyName, setCompanyName] = useState('')
  const [taxCode, setTaxCode] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Session State
  const [session, setSession] = useState<GuestRegistrationSessionResponse | null>(null)

  // Step 2: OTP State
  const [otp, setOtp] = useState('')
  const [cooldown, setCooldown] = useState(0)

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
    if (!companyName.trim()) errs.companyName = 'Vui lòng nhập tên công ty'
    if (!taxCode.trim()) {
      errs.taxCode = 'Vui lòng nhập mã số thuế'
    } else if (!TAX_CODE_REGEX.test(taxCode.trim())) {
      errs.taxCode = 'Mã số thuế phải có 10 hoặc 13 chữ số'
    }
    if (!fullName.trim()) errs.fullName = 'Vui lòng nhập họ và tên người đại diện'
    if (!email.trim()) {
      errs.email = 'Vui lòng nhập email nhận tài khoản'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errs.email = 'Email không hợp lệ'
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
        taxCode: taxCode.trim(),
        companyAddress: companyAddress.trim() || undefined,
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        phoneNumber: phoneNumber.trim() || undefined,
      })
      setSession(resp)
      setCurrentStep(2)
      setCooldown(60)
      toast.success('Mã OTP xác thực đã được gửi đến email của bạn.')
    } catch (err) {
      toast.error(dataErrorMessage(err, t))
    } finally {
      setLoading(false)
    }
  }

  async function handleStep2VerifyOtp(e: React.FormEvent) {
    e.preventDefault()
    if (!session || otp.length < 6) return

    setLoading(true)
    try {
      const resp = await verifyRegistrationOtp({
        token: session.token,
        otp: otp.trim(),
      })
      setSession(resp)
      setCurrentStep(3)
      toast.success('Xác thực email thành công!')
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
      toast.success('Đã gửi lại mã OTP.')
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
      toast.success('Đã chấp thuận điều khoản dịch vụ.')
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
        toast.info('Đang chuyển hướng sang cổng thanh toán VNPay...')
        window.location.href = resp.paymentUrl
      } else {
        toast.error('Không tìm thấy liên kết thanh toán.')
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
              <span>Kích Hoạt Tài Khoản Tức Thì 24/7</span>
            </div>
            <h1 className="mt-3 text-h1 font-bold text-ink-strong">
              Đăng Ký Tài Khoản Doanh Nghiệp
            </h1>
            <p className="mt-2 text-body text-ink-2">
              Hoàn tất 4 bước đơn giản để sở hữu hệ thống tối ưu vận tải và nhận tài khoản quản trị ngay lập tức.
            </p>
          </div>

          {/* Stepper Indicator */}
          <div className="mb-8 flex items-center justify-between">
            {[
              { num: 1, label: 'Thông tin' },
              { num: 2, label: 'Xác thực OTP' },
              { num: 3, label: 'Thỏa thuận' },
              { num: 4, label: 'Thanh toán' },
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

          <Card className="border-border bg-bg shadow-sm">
            {/* STEP 1: INFO */}
            {currentStep === 1 && (
              <form onSubmit={handleStep1Submit}>
                <CardHeader>
                  <CardTitle as="h2" className="text-h2">Bước 1: Thông tin Doanh nghiệp & Quản trị viên</CardTitle>
                  <p className="text-small text-ink-2">
                    Cung cấp thông tin đăng ký kinh doanh chính xác để kích hoạt công ty và xuất hóa đơn điện tử.
                  </p>
                </CardHeader>

                <div className="flex flex-col gap-5 p-6 pt-0">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="companyName" className="text-small font-medium text-ink-strong">
                        Tên doanh nghiệp <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="companyName"
                        placeholder="Công ty Cổ phần Vận tải & Tiếp vận Toàn Cầu"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className={cn(PUBLIC_TOUCH, errors.companyName && 'border-danger')}
                      />
                      {errors.companyName && <span className="text-caption text-danger">{errors.companyName}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="taxCode" className="text-small font-medium text-ink-strong">
                        Mã số thuế <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="taxCode"
                        placeholder="0101234567"
                        value={taxCode}
                        onChange={(e) => setTaxCode(e.target.value)}
                        className={cn(PUBLIC_TOUCH, errors.taxCode && 'border-danger')}
                      />
                      {errors.taxCode ? (
                        <span className="text-caption text-danger">{errors.taxCode}</span>
                      ) : (
                        <span className="text-caption text-ink-3">10 hoặc 13 chữ số</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="companyAddress" className="text-small font-medium text-ink-strong">Địa chỉ đăng ký kinh doanh</label>
                      <Input
                        id="companyAddress"
                        placeholder="Tòa nhà Landmark 81, Quận Bình Thạnh, TP. HCM"
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        className={PUBLIC_TOUCH}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="fullName" className="text-small font-medium text-ink-strong">
                        Họ và tên người đại diện quản trị <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="fullName"
                        placeholder="Trần Văn Minh"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={cn(PUBLIC_TOUCH, errors.fullName && 'border-danger')}
                      />
                      {errors.fullName && <span className="text-caption text-danger">{errors.fullName}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="email" className="text-small font-medium text-ink-strong">
                        Email nhận tài khoản & Hóa đơn <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@toancau.vn"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={cn(PUBLIC_TOUCH, errors.email && 'border-danger')}
                      />
                      {errors.email && <span className="text-caption text-danger">{errors.email}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="phoneNumber" className="text-small font-medium text-ink-strong">Số điện thoại liên hệ</label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        placeholder="0988 776 655"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className={PUBLIC_TOUCH}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
                    <Button asChild variant="ghost">
                      <Link to="/bang-gia">
                        <ArrowLeft className="mr-1.5 size-4" /> Quay lại Bảng giá
                      </Link>
                    </Button>
                    <Button type="submit" variant="primary" disabled={loading} className={cn('min-w-44', PUBLIC_TOUCH)}>
                      {loading ? <Spinner className="size-4" /> : null}
                      Tiếp tục xác thực OTP
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* STEP 2: OTP */}
            {currentStep === 2 && (
              <form onSubmit={handleStep2VerifyOtp}>
                <CardHeader>
                  <CardTitle as="h2" className="text-h2">Bước 2: Xác thực Email</CardTitle>
                  <p className="text-small text-ink-2">
                    Nhập mã 6 chữ số gửi đến <strong className="text-ink-strong">{session?.maskedEmail ?? email}</strong>.
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
                      placeholder="Nhập 6 số OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                      className={cn('text-center font-mono text-2xl tracking-widest', PUBLIC_TOUCH)}
                    />
                  </div>

                  <div className="text-caption text-ink-2">
                    {cooldown > 0 ? (
                      <span className="text-ink-3">Có thể yêu cầu lại sau {cooldown}s</span>
                    ) : (
                      <button
                        type="button"
                        onClick={handleResendOtp}
                        disabled={loading}
                        className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                      >
                        <RotateCw className="size-3.5" /> Gửi lại mã OTP
                      </button>
                    )}
                  </div>

                  <div className="w-full flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4 mt-2">
                    <Button type="button" variant="ghost" onClick={() => setCurrentStep(1)} disabled={loading}>
                      <ArrowLeft className="mr-1.5 size-4" /> Quay lại Bước 1
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={loading || otp.length < 6}
                      className={cn('min-w-44', PUBLIC_TOUCH)}
                    >
                      {loading ? <Spinner className="size-4" /> : <ShieldCheck className="mr-1.5 size-4" />}
                      Xác nhận OTP
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* STEP 3: SAAS AGREEMENT */}
            {currentStep === 3 && (
              <form onSubmit={handleStep3AcceptPolicy}>
                <CardHeader>
                  <CardTitle as="h2" className="text-h2">Bước 3: Thỏa thuận Dịch vụ Điện tử SaaS</CardTitle>
                  <p className="text-small text-ink-2">
                    Vui lòng đọc và chấp thuận các điều khoản cung cấp dịch vụ phần mềm LoadMaster.
                  </p>
                </CardHeader>

                <div className="flex flex-col gap-5 p-6 pt-0">
                  <div className="max-h-60 overflow-y-auto rounded-md border border-line-soft bg-muted/30 p-4 text-small text-ink-2 leading-relaxed">
                    <h4 className="font-semibold text-ink-strong mb-2">ĐIỀU KHOẢN VÀ CHÍNH SÁCH SỬ DỤNG LOADMASTER</h4>
                    <p className="mb-2">1. <strong>Phạm vi cung cấp:</strong> LoadMaster cung cấp nền tảng SaaS tối ưu hóa thể tích chất xếp hàng và quy hoạch tuyến đường giao vận tải theo gói đăng ký doanh nghiệp.</p>
                    <p className="mb-2">2. <strong>Bảo mật thông tin:</strong> Chúng tôi cam kết bảo mật toàn diện danh sách đơn hàng, kho bãi và đội xe của doanh nghiệp bằng mã hóa tiêu chuẩn ngành.</p>
                    <p className="mb-2">3. <strong>Hóa đơn và Kích hoạt:</strong> Sau khi thanh toán thành công, hệ thống tự động xuất hóa đơn điện tử (PDF) gửi về email của bạn kèm tài khoản và mật khẩu tạm.</p>
                    <p>4. <strong>Chính sách hoàn tiền:</strong> Do tính chất dịch vụ số được cấp tức thời, phí đăng ký gói cước không hoàn lại trừ trường hợp lỗi kỹ thuật từ phía nền tảng.</p>
                  </div>

                  <div className="flex items-start gap-3 rounded-md border border-primary/20 bg-primary/5 p-4">
                    <Checkbox
                      id="policyCheck"
                      checked={policyAccepted}
                      onCheckedChange={(checked) => setPolicyAccepted(Boolean(checked))}
                      className="mt-1"
                    />
                    <label htmlFor="policyCheck" className="text-body cursor-pointer font-normal text-ink-strong">
                      Tôi xác nhận là đại diện hợp pháp của doanh nghiệp{' '}
                      <strong>{session?.companyName ?? companyName}</strong>, đồng ý với tất cả điều khoản dịch vụ và chính sách bảo mật của LoadMaster.
                    </label>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
                    <Button type="button" variant="ghost" onClick={() => setCurrentStep(2)} disabled={loading}>
                      <ArrowLeft className="mr-1.5 size-4" /> Quay lại
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={!policyAccepted || loading}
                      className={cn('min-w-44', PUBLIC_TOUCH)}
                    >
                      {loading ? <Spinner className="size-4" /> : <FileText className="mr-1.5 size-4" />}
                      Đồng ý & Tiếp tục
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {/* STEP 4: PLAN & PAYMENT */}
            {currentStep === 4 && (
              <form onSubmit={handleStep4Payment}>
                <CardHeader>
                  <CardTitle as="h2" className="text-h2">Bước 4: Chọn Gói & Thanh toán VNPay</CardTitle>
                  <p className="text-small text-ink-2">
                    Chọn gói cước và chu kỳ thanh toán phù hợp với quy mô đội xe của bạn.
                  </p>
                </CardHeader>

                <div className="flex flex-col gap-6 p-6 pt-0">
                  {/* Plan Selection */}
                  <div className="flex flex-col gap-3">
                    <label className="text-body font-semibold text-ink-strong">Chọn gói cước:</label>
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
                              <span className="text-caption font-normal text-ink-2">/tháng</span>
                            </div>
                          </div>
                          <div className="mt-3 border-t border-border/50 pt-2 text-caption text-ink-2">
                            {p.monthlyCredits ? `${format.integer(p.monthlyCredits)} credits/tháng` : 'Không giới hạn credit'}
                          </div>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>

                  {/* Billing Cycle */}
                  <div className="flex flex-col gap-3">
                    <label className="text-body font-semibold text-ink-strong">Chu kỳ thanh toán:</label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant={billingCycle === '1' ? 'primary' : 'secondary'}
                        onClick={() => setBillingCycle('1')}
                        className="h-12"
                      >
                        Thanh toán 1 tháng
                      </Button>
                      <Button
                        type="button"
                        variant={billingCycle === '12' ? 'primary' : 'secondary'}
                        onClick={() => setBillingCycle('12')}
                        className="h-12 relative"
                      >
                        Thanh toán 1 năm
                        <span className="ml-2 rounded-full bg-warning px-2 py-0.5 text-[11px] font-bold text-slate-900">
                          Tiết kiệm 15%
                        </span>
                      </Button>
                    </div>
                  </div>

                  {/* Summary & Price */}
                  <div className="rounded-lg border border-border bg-muted/20 p-4">
                    <div className="flex items-baseline justify-between border-b border-border/50 pb-2">
                      <span className="text-body text-ink-2">Gói đã chọn:</span>
                      <strong className="text-body text-ink-strong">{selectedPlan?.name ?? '—'}</strong>
                    </div>
                    <div className="flex items-baseline justify-between pt-3">
                      <span className="text-h3 font-bold text-ink-strong">Tổng số tiền thanh toán:</span>
                      <span className="text-h2 font-extrabold text-primary tabular-nums">
                        {format.currency(totalPrice)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
                    <Button type="button" variant="ghost" onClick={() => setCurrentStep(3)} disabled={loading}>
                      <ArrowLeft className="mr-1.5 size-4" /> Quay lại Bước 3
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={loading || !selectedPlanId}
                      className={cn('min-w-56 font-bold', PUBLIC_TOUCH)}
                    >
                      {loading ? <Spinner className="size-4" /> : <CreditCard className="mr-2 size-5" />}
                      Thanh toán qua VNPay
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
