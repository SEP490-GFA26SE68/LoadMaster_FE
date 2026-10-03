import {
  useEffect,
  useMemo,
  useState,
} from 'react'
import {
  Link,
  Navigate,
  useNavigate,
  useSearchParams,
} from 'react-router'

import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import {
  requestPasswordReset,
  verifyPasswordResetOtp,
} from './auth-api'
import { OtpInput } from '../../components/OtpInput'

const RESEND_SECONDS = 60

export function VerifyOtpPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const email = searchParams.get('email')

  const [otp, setOtp] = useState('')
  const [serverError, setServerError] =
    useState<string | null>(null)

  const [secondsLeft, setSecondsLeft] =
    useState(RESEND_SECONDS)

  const [resending, setResending] =
    useState(false)

  const [submitting, setSubmitting] =
    useState(false)

  useEffect(() => {
    if (secondsLeft <= 0) return

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          window.clearInterval(timer)
          return 0
        }

        return current - 1
      })
    }, 1000)

    return () =>
      window.clearInterval(timer)
  }, [secondsLeft])

  const maskedEmail = useMemo(() => {
    if (!email) return ''

    const [name, domain] =
      email.split('@')

    if (!domain) return email

    const visible =
      name.length <= 2
        ? name[0] ?? ''
        : `${name.slice(0, 2)}***`

    return `${visible}@${domain}`
  }, [email])

  if (!email) {
    return (
      <Navigate
        to="/quen-mat-khau"
        replace
      />
    )
  }

  async function handleSubmit() {
    setServerError(null)

    if (!/^\d{6}$/.test(otp)) {
      setServerError(
        'Vui lòng nhập đủ 6 chữ số OTP',
      )
      return
    }

    setSubmitting(true)

    try {
      const resetToken =
        await verifyPasswordResetOtp(
          email,
          otp,
        )

      navigate(
        `/dat-lai-mat-khau?token=${encodeURIComponent(resetToken)}`,
        {
          replace: true,
        },
      )
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Không thể xác thực OTP',
      )
    } finally {
      setSubmitting(false)
    }
  }

  async function handleResend() {
    if (
      secondsLeft > 0 ||
      resending
    ) {
      return
    }

    setServerError(null)
    setResending(true)

    try {
      await requestPasswordReset(email)

      setOtp('')
      setSecondsLeft(
        RESEND_SECONDS,
      )
    } catch (error) {
      setServerError(
        error instanceof Error
          ? error.message
          : 'Không thể gửi lại OTP',
      )
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-md rounded-xl border border-border bg-white p-8 shadow-lg">

        <div className="mb-8 flex flex-col items-center gap-4 text-center">
          <Logo size="md" />

          <div>
            <h1 className="text-h1 font-semibold">
              Xác thực OTP
            </h1>

            <p className="mt-2 text-body text-text-2">
              Mã xác thực đã được gửi tới{' '}
              <span className="font-medium text-ink-1">
                {maskedEmail}
              </span>
            </p>

            <p className="mt-1 text-small text-text-2">
              Mã OTP có hiệu lực trong
              3 phút.
            </p>
          </div>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault()
            void handleSubmit()
          }}
          className="flex flex-col gap-5"
        >

          <div className="flex flex-col gap-3">
            <label className="text-body font-medium text-ink-1">
              Mã OTP
            </label>

            <OtpInput
              value={otp}
              onChange={setOtp}
              disabled={
                submitting
              }
            />

            <p className="text-center text-small text-text-2">
              Nhập mã gồm 6 chữ số
              được gửi qua email
            </p>
          </div>

          {serverError ? (
            <p
              role="alert"
              className="
                rounded-md
                border
                border-badge-danger-border
                bg-badge-danger-bg
                px-3 py-2
                text-body
                text-badge-danger-fg
              "
            >
              {serverError}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            block
            loading={submitting}
          >
            Xác thực OTP
          </Button>

          <div className="text-center text-body text-text-2">
            {secondsLeft > 0 ? (
              <span>
                Gửi lại mã sau{' '}
                {secondsLeft}s
              </span>
            ) : (
              <button
                type="button"
                onClick={() =>
                  void handleResend()
                }
                disabled={resending}
                className="
                  font-medium
                  text-primary
                  hover:underline
                  disabled:cursor-not-allowed
                  disabled:opacity-60
                "
              >
                {resending
                  ? 'Đang gửi lại...'
                  : 'Gửi lại mã OTP'}
              </button>
            )}
          </div>

          <Link
            to="/quen-mat-khau"
            className="text-center text-body text-primary hover:underline"
          >
            Đổi email
          </Link>

        </form>
      </div>
    </div>
  )
}