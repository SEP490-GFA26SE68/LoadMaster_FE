import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { ROLE_HOME } from '@/features/auth/landing'
import { useT } from '@/lib/i18n'
import { ErrorScreen } from './ErrorScreen'
import { useDocumentTitle } from './route-title'

/**
 * Màn lỗi chung: dùng cho cả route không tồn tại (404) lẫn lỗi bất ngờ khi render. Không hiện stack trace cho người dùng cuối.
 * Nằm ngoài `RouteOutlet` nên tự đặt tiêu đề tab. "Về màn chính" mở màn chính của vai trò đang đăng nhập (như màn 403), chưa
 * đăng nhập thì về màn đăng nhập.
 */
export function NotFoundPage() {
  const t = useT()
  const { user } = useAuth()
  const error = useRouteError()
  // Không có error nghĩa là component được dùng làm route bắt mọi đường dẫn lạ.
  const isNotFound = !error || (isRouteErrorResponse(error) && error.status === 404)
  const code = isRouteErrorResponse(error) ? String(error.status) : isNotFound ? '404' : t('notFound.errorCode')
  useDocumentTitle(isNotFound ? t('titles.notFound') : t('titles.error'))

  return (
    <ErrorScreen
      code={code}
      mascot={isNotFound ? 'notFound' : 'error'}
      title={isNotFound ? t('notFound.title') : t('notFound.errorTitle')}
      description={isNotFound ? t('notFound.description') : t('notFound.errorDescription')}
      actions={
        <>
          <Button variant="primary" asChild>
            <Link to={user ? ROLE_HOME[user.role] : '/dang-nhap'}>{t('notFound.backHome')}</Link>
          </Button>
          <Button variant="secondary" onClick={() => window.location.reload()}>
            {t('notFound.reload')}
          </Button>
        </>
      }
    />
  )
}
