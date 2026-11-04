import { KeyRound } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { passwordResetPath } from '@/features/auth/landing'
import { useT } from '@/lib/i18n'
import { SECTION_TEXT, TOUCH_CONTROL } from './profile-styles'

/**
 * Thẻ mật khẩu khi đăng nhập bằng Keycloak: backend chưa có lối đổi mật khẩu bằng mật khẩu hiện tại, nên đổi mật khẩu đi qua luồng
 * đặt mật khẩu mới bằng mã gửi về email của tài khoản — ngay trong app, không sang trang của Keycloak. Nút phụ: đây là lối sang trang
 * khác, không phải hành động chính của màn.
 */
export function AccountPasswordCard({ email }: { email: string }) {
  const t = useT()
  const titleId = useId()
  return (
    <section aria-labelledby={titleId}>
      <Card>
        <CardHeader>
          <CardTitle as="h2" id={titleId}>{t('profile.account.title')}</CardTitle>
          <CardMeta className={SECTION_TEXT}>{t('profile.account.description')}</CardMeta>
        </CardHeader>
        <CardBody className="p-5">
          <Button asChild variant="secondary" className={TOUCH_CONTROL}>
            <Link to={passwordResetPath(email)}>
              <KeyRound strokeWidth={1.5} aria-hidden />
              {t('profile.account.changePassword')}
            </Link>
          </Button>
        </CardBody>
      </Card>
    </section>
  )
}
