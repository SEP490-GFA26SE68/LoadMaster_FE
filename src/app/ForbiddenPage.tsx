import { House } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { ROLE_HOME } from '@/features/auth/landing'
import { useT } from '@/lib/i18n'
import { ErrorScreen } from './ErrorScreen'

/** 403 (D-41): người đăng nhập không có quyền mở màn này. Nút về màn chính của vai trò — không để người dùng kẹt. */
export function ForbiddenPage() {
  const t = useT()
  const { user } = useAuth()
  return (
    <ErrorScreen
      code="403"
      mascot="error"
      title={t('notFound.forbiddenTitle')}
      description={t('notFound.forbiddenDescription', { role: user ? t(`roles.${user.role}`) : '' })}
      actions={
        <Button variant="primary" asChild>
          <Link to={user ? ROLE_HOME[user.role] : '/dang-nhap'}>
            <House aria-hidden strokeWidth={1.5} />
            {t('notFound.backHome')}
          </Link>
        </Button>
      }
    />
  )
}
