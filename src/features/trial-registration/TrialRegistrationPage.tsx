import { AlertCircle, ArrowLeft, CheckCircle2, Clock, Mail, RotateCw, Send, ShieldCheck, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { PublicFooter } from '@/features/marketing/PublicFooter'
import { PublicHeader } from '@/features/marketing/PublicHeader'
import { PUBLIC_TOUCH } from '@/features/marketing/public-chrome'
import { usePublicPlansQuery } from '@/features/marketing/useMarketingQuery'
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
  const [params] = useSearchParams()
  const pricingQuery = usePublicPlansQuery()

  const [step, setStep] = useState<Step>('info')
  const [loading, setLoading] = useState(false)

  // Form info state
  const [companyName, setCompanyName] = useState('')
  const [taxCode, setTaxCode] = useState('')
  const [companyAddress, setCompanyAddress] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [interestedPlanId, setInterestedPlanId] = useState<string>(params.get('planId') ?? '')
  const [note, setNote] = useState('')

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Session state after Step 1
  const [session, setSession] = useState<GuestTrialInitResponse | null>(null)

  // OTP state
  const [otp, setOtp] = useState('')
  const [cooldown, setCooldown] = useState(0)

  // Result state
  const [result, setResult] = useState<GuestTrialVerifyResponse | null>(null)

  // Countdown timer effect
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldown])

  // Set default plan if url param updates
  useEffect(() => {
    const p = params.get('planId')
    if (p) setInterestedPlanId(p)
  }, [params])

  function validateStep1(): boolean {
    const newErrors: Record<string, string> = {}
    if (!companyName.trim()) newErrors.companyName = 'Vui lòng nhập tên doanh nghiệp'
    if (!taxCode.trim()) {
      newErrors.taxCode = 'Vui lòng nhập mã số thuế'
    } else if (!TAX_CODE_REGEX.test(taxCode.trim())) {
      newErrors.taxCode = 'Mã số thuế phải có 10 hoặc 13 chữ số (VD: 0101234567 hoặc 0101234567-001)'
    }
    if (!fullName.trim()) newErrors.fullName = 'Vui lòng nhập họ và tên người đại diện'
    if (!email.trim()) {
      newErrors.email = 'Vui lòng nhập email nhận tài khoản'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Email không đúng định dạng'
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
        phoneNumber: phoneNumber.trim() || undefined,
        interestedPlanId: interestedPlanId ? Number(interestedPlanId) : undefined,
        note: note.trim() || undefined,
      })
      setSession(resp)
      setStep('otp')
      setCooldown(60)
      toast.success(resp.message)
    } catch (err) {
      toast.error(dataErrorMessage(err, t))
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
              <Sparkles className="size-3.5" />
              <span>Chương trình Dùng thử Miễn phí LoadMaster</span>
            </div>
            <h1 className="mt-3 text-h1 font-bold text-ink-strong">
              Đăng Ký Trải Nghiệm Giải Pháp
            </h1>
            <p className="mt-2 text-body text-ink-2">
              Khám phá năng lực lập kế hoạch chất xếp hàng 3D & tối ưu lộ trình xe tải cho doanh nghiệp của bạn.
            </p>
          </div>

          <Card className="border-border bg-bg shadow-sm">
            {step === 'info' && (
              <form onSubmit={handleInitSubmit}>
                <CardHeader>
                  <CardTitle as="h2" className="text-h2">1. Thông tin Doanh nghiệp & Người đại diện</CardTitle>
                  <p className="text-small text-ink-2">
                    Vui lòng cung cấp chính xác mã số thuế và email để hệ thống xác thực và cấp quyền dùng thử.
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
                        placeholder="Công ty TNHH Vận tải & Logistics ABC"
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
                        <span className="text-caption text-ink-3">Gồm 10 hoặc 13 chữ số</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="interestedPlan" className="text-small font-medium text-ink-strong">Gói muốn trải nghiệm</label>
                      <Select value={interestedPlanId} onValueChange={setInterestedPlanId}>
                        <SelectTrigger id="interestedPlan" className={PUBLIC_TOUCH}>
                          <SelectValue placeholder="Chọn gói cước trải nghiệm" />
                        </SelectTrigger>
                        <SelectContent>
                          {(pricingQuery.data ?? []).map((p: SubscriptionPlan) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="companyAddress" className="text-small font-medium text-ink-strong">Địa chỉ trụ sở</label>
                      <Input
                        id="companyAddress"
                        placeholder="Số 123 Đường Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh"
                        value={companyAddress}
                        onChange={(e) => setCompanyAddress(e.target.value)}
                        className={PUBLIC_TOUCH}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="fullName" className="text-small font-medium text-ink-strong">
                        Họ và tên người liên hệ / quản trị <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="fullName"
                        placeholder="Nguyễn Văn A"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className={cn(PUBLIC_TOUCH, errors.fullName && 'border-danger')}
                      />
                      {errors.fullName && <span className="text-caption text-danger">{errors.fullName}</span>}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="email" className="text-small font-medium text-ink-strong">
                        Email nhận tài khoản <span className="text-danger">*</span>
                      </label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="admin@doanhnghiep.vn"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className={cn(PUBLIC_TOUCH, errors.email && 'border-danger')}
                      />
                      {errors.email ? (
                        <span className="text-caption text-danger">{errors.email}</span>
                      ) : (
                        <span className="text-caption text-ink-3">Chúng tôi sẽ gửi mã OTP qua email này</span>
                      )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="phoneNumber" className="text-small font-medium text-ink-strong">Số điện thoại</label>
                      <Input
                        id="phoneNumber"
                        type="tel"
                        placeholder="0912 345 678"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        className={PUBLIC_TOUCH}
                      />
                    </div>

                    <div className="flex flex-col gap-1.5 sm:col-span-2">
                      <label htmlFor="note" className="text-small font-medium text-ink-strong">Nhu cầu hoặc ghi chú thêm</label>
                      <Textarea
                        id="note"
                        placeholder="Mô tả số lượng xe tải, loại hàng hóa hoặc các yêu cầu xếp hàng đặc thù..."
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <Button asChild variant="ghost">
                      <Link to="/bang-gia">
                        <ArrowLeft className="mr-1.5 size-4" /> Quay lại Bảng giá
                      </Link>
                    </Button>
                    <Button type="submit" variant="primary" disabled={loading} className={cn('min-w-44', PUBLIC_TOUCH)}>
                      {loading ? <Spinner className="size-4" /> : <Send className="mr-1.5 size-4" />}
                      Tiếp tục xác thực OTP
                    </Button>
                  </div>
                </div>
              </form>
            )}

            {step === 'otp' && (
              <form onSubmit={handleVerifyOtp}>
                <CardHeader>
                  <CardTitle as="h2" className="text-h2">2. Xác thực Email Người đại diện</CardTitle>
                  <p className="text-small text-ink-2">
                    Mã xác thực 6 chữ số đã được gửi tới{' '}
                    <strong className="text-ink-strong">{session?.maskedEmail ?? email}</strong>.
                    Vui lòng nhập mã để hoàn tất đơn đăng ký.
                  </p>
                </CardHeader>

                <div className="flex flex-col gap-6 p-6 pt-0">
                  <div className="flex flex-col items-center gap-4 py-4 text-center">
                    <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                      <Mail className="size-7" />
                    </div>

                    <div className="w-full max-w-xs flex flex-col gap-2">
                      <label htmlFor="otp" className="sr-only">Mã xác thực OTP</label>
                      <Input
                        id="otp"
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
                        <span className="inline-flex items-center gap-1.5 text-ink-3">
                          <Clock className="size-3.5" /> Có thể gửi lại sau {cooldown}s
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleResendOtp}
                          disabled={loading}
                          className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
                        >
                          <RotateCw className="size-3.5" /> Gửi lại mã xác thực
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-t border-border pt-4">
                    <Button type="button" variant="ghost" onClick={() => setStep('info')} disabled={loading}>
                      <ArrowLeft className="mr-1.5 size-4" /> Sửa lại thông tin
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={loading || otp.length < 6}
                      className={cn('min-w-44', PUBLIC_TOUCH)}
                    >
                      {loading ? <Spinner className="size-4" /> : <ShieldCheck className="mr-1.5 size-4" />}
                      Xác nhận đăng ký dùng thử
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
                  Đăng Ký Dùng Thử Thành Công!
                </h2>
                <p className="mt-2 max-w-md text-body text-ink-2">
                  Hệ thống đã hoàn tất đối soát tự động sơ bộ. Yêu cầu của bạn đã được chuyển tới{' '}
                  <strong className="text-ink-strong">System Manager</strong> để thẩm định và tiến hành cấp tài khoản quản trị.
                </p>

                <div className="mt-6 w-full max-w-lg rounded-lg border border-primary/20 bg-primary/5 p-4 text-left">
                  <div className="flex flex-col gap-1 text-small text-ink-strong">
                    <strong>Thông tin đã tiếp nhận:</strong>
                    <span>Doanh nghiệp: {companyName}</span>
                    <span>Mã số thuế: {taxCode}</span>
                    <span>Email quản trị: {email}</span>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-3 justify-center">
                  <Button asChild variant="primary">
                    <Link to="/gioi-thieu">Về trang giới thiệu</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link to="/dang-nhap">Đến trang Đăng nhập</Link>
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
                  Yêu Cầu Chưa Được Phê Duyệt
                </h2>
                <p className="mt-2 max-w-md text-body text-ink-2">
                  Qua quá trình đối soát thông tin tự động, hệ thống nhận thấy thông tin đăng ký của bạn chưa đủ điều kiện kích hoạt dùng thử.
                </p>

                <div className="mt-6 w-full max-w-lg rounded-lg border border-danger/20 bg-danger/5 p-4 text-left">
                  <div className="flex flex-col gap-1 text-small text-danger">
                    <strong>Lý do từ chối (AI Pre-check):</strong>
                    <span>{result?.aiPrecheckReason ?? 'Thông tin mã số thuế hoặc email đã tồn tại trên hệ thống.'}</span>
                  </div>
                </div>

                <p className="mt-4 text-caption text-ink-3 max-w-md">
                  Chi tiết lý do từ chối cũng đã được gửi đến email của bạn. Nếu có nhu cầu giải đáp thắc mắc, vui lòng gửi yêu cầu liên hệ tư vấn.
                </p>

                <div className="mt-8 flex flex-wrap gap-3 justify-center">
                  <Button type="button" variant="secondary" onClick={() => setStep('info')}>
                    Chỉnh sửa lại thông tin
                  </Button>
                  <Button asChild variant="primary">
                    <Link to="/gioi-thieu#lien-he">Liên hệ hỗ trợ tư vấn</Link>
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
