import { ExternalLink } from 'lucide-react'
import { useId } from 'react'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { useT } from '@/lib/i18n'
import { accountConsoleUrl } from './profile-api'
import { SECTION_TEXT, TOUCH_CONTROL } from './profile-styles'

/**
 * Thẻ mật khẩu khi đăng nhập bằng Keycloak: app không thu mật khẩu, nên chỉ có liên kết tới trang tài khoản của Keycloak (thẻ mới) —
 * không có form đổi mật khẩu giả. Nút phụ: đây là lối sang trang khác, không phải hành động chính của màn.
 */
export function AccountPasswordCard() {
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
            <a href={accountConsoleUrl()} target="_blank" rel="noreferrer">
              <ExternalLink strokeWidth={1.5} aria-hidden />
              {t('profile.account.changePassword')}{' '}
              <span className="sr-only">{t('profile.account.newTab')}</span>
            </a>
          </Button>
        </CardBody>
      </Card>
    </section>
  )
}
