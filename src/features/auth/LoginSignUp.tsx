import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { REGISTRATION_CAPABILITIES } from '@/features/registration/useRegistrationQuery'
import { useT } from '@/lib/i18n'
import { GUEST_REGISTRATION, TRIAL_REGISTRATION } from './landing'

/**
 * Lối vào hai luồng đăng ký công khai ngay dưới form đăng nhập: người chưa có tài khoản thường mở màn này trước tiên. Hai nút phụ — nút
 * chính của màn vẫn là "Đăng nhập". Chỉ khi nhóm `registration` nối backend; kho mẫu không có luồng đăng ký (D-20) nên không vẽ gì.
 */
export function LoginSignUp({ controlClassName }: { controlClassName?: string }) {
  const t = useT()
  if (!REGISTRATION_CAPABILITIES.publicSignUp) return null

  return (
    <div className="flex flex-col gap-3 border-t border-line-soft pt-4">
      <p className="text-body text-text-2 pointer-coarse:text-body-lg">{t('auth.login.noAccount')}</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button asChild variant="secondary" block className={controlClassName}>
          <Link to={TRIAL_REGISTRATION}>{t('landing.header.trial')}</Link>
        </Button>
        <Button asChild variant="secondary" block className={controlClassName}>
          <Link to={GUEST_REGISTRATION}>{t('landing.header.registerNow')}</Link>
        </Button>
      </div>
    </div>
  )
}
