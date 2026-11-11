import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/features/auth/AuthProvider'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { SignAgreementRequest } from './agreements-api'
import { SignAgreementDialog } from './SignAgreementDialog'
import { TrialAgreementBanner } from './TrialAgreementBanner'
import { useMyAgreementQuery, useSignAgreementMutation } from './useAgreementQuery'

/**
 * Thành phần cảnh báo toàn cục và tự động bật popup ký Thỏa thuận dịch vụ thử nghiệm (72h / 30 ngày)
 * Dành cho tài khoản Company Admin (`companyAdmin`).
 */
export function TrialAgreementNotifier() {
  const t = useT()
  const { user, refreshUser } = useAuth()
  const isCompanyAdmin = user?.role === 'companyAdmin'

  const { data: agreement } = useMyAgreementQuery()
  const sign = useSignAgreementMutation()
  const [signOpen, setSignOpen] = useState(false)

  // Tự động bật modal ký trong phiên đăng nhập đầu tiên khi thỏa thuận đang chờ ký (PENDING)
  useEffect(() => {
    if (isCompanyAdmin && agreement && agreement.status === 'PENDING') {
      const sessionKey = `lm_agr_popup_${agreement.id}`
      if (!sessionStorage.getItem(sessionKey)) {
        setSignOpen(true)
        sessionStorage.setItem(sessionKey, '1')
      }
    }
  }, [isCompanyAdmin, agreement])

  if (!isCompanyAdmin || !agreement || agreement.status === 'SIGNED') {
    return null
  }

  function handleSign(request: SignAgreementRequest) {
    sign.mutate(request, {
      onSuccess: () => {
        setSignOpen(false)
        toast.success(t('billing.agreementSigned'))
        refreshUser()
      },
      onError: (err) => {
        toast.error(dataErrorMessage(err, t))
      },
    })
  }

  return (
    <>
      <div className="shrink-0 px-4 py-2 border-b border-border bg-surface-subtle">
        <TrialAgreementBanner agreement={agreement} onOpenSignDialog={() => setSignOpen(true)} />
      </div>

      <SignAgreementDialog
        agreement={agreement}
        open={signOpen}
        onClose={() => setSignOpen(false)}
        onSign={handleSign}
        isSigning={sign.isPending}
      />
    </>
  )
}

