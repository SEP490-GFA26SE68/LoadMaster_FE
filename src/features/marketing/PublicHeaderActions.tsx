import { Link } from 'react-router'
import { LanguageMenu } from '@/components/LanguageMenu'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { SKY_FOCUS } from '@/components/sky-focus'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/features/auth/AuthProvider'
import { GUEST_REGISTRATION, landingPath, TRIAL_REGISTRATION } from '@/features/auth/landing'
import { REGISTRATION_CAPABILITIES } from '@/features/registration/useRegistrationQuery'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PUBLIC_TOUCH } from './public-chrome'
import { PublicNavMenu } from './PublicNavMenu'

/**
 * Phần phải của đầu trang công khai: ngôn ngữ (hai nút VI | EN từ 640 px, hẹp hơn là một nút mở menu — điện thoại 360 px không đủ chỗ
 * cho hai nút 56 px cạnh "Đăng nhập" và nút menu), lối đăng ký, "Đăng nhập" (đã đăng nhập thì "Vào ứng dụng", mở màn chính của vai trò)
 * và nút menu ở bề rộng chưa có hàng mục. Khi nối backend (`REGISTRATION_CAPABILITIES`), khách chưa đăng nhập có nút kính "Đăng ký trải
 * nghiệm" từ 768 px và "Đăng ký dùng ngay" từ 1.280 px (hẹp hơn thì nằm trong nút menu); kho mẫu và người đã đăng nhập không có. Mọi nút
 * là kính trên dải trời — nút chính là của trang.
 */
export function PublicHeaderActions() {
  const t = useT()
  const { user } = useAuth()

  return (
    <div className="ml-auto flex flex-none items-center gap-2 xl:gap-3">
      <LanguageSwitch
        tone="sky"
        className="hidden sm:flex pointer-coarse:[&_button]:size-14 pointer-coarse:[&_button]:text-body-lg"
      />
      <LanguageMenu
        className="h-10 min-w-10 sm:hidden pointer-coarse:h-14 pointer-coarse:min-w-14 pointer-coarse:text-body-lg"
        itemClassName={PUBLIC_TOUCH}
      />
      {!user && REGISTRATION_CAPABILITIES.publicSignUp ? (
        <>
          <Button asChild variant="glass" className={cn(PUBLIC_TOUCH, SKY_FOCUS, 'hidden md:inline-flex')}>
            <Link to={TRIAL_REGISTRATION}>{t('landing.header.trial')}</Link>
          </Button>
          <Button asChild variant="glass" className={cn(PUBLIC_TOUCH, SKY_FOCUS, 'hidden xl:inline-flex')}>
            <Link to={GUEST_REGISTRATION}>{t('landing.header.registerNow')}</Link>
          </Button>
        </>
      ) : null}
      <Button asChild variant="glass" className={cn(PUBLIC_TOUCH, SKY_FOCUS)}>
        <Link to={user ? landingPath(user.role) : '/dang-nhap'}>
          {user ? t('landing.header.openApp') : t('landing.header.signIn')}
        </Link>
      </Button>
      <PublicNavMenu className="lg:pointer-fine:hidden min-[1366px]:hidden" />
    </div>
  )
}
