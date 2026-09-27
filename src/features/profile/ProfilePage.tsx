import { PageHero } from '@/components/PageHero'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { useT } from '@/lib/i18n'
import { PasswordForm } from './PasswordForm'
import { ProfileDetailsForm } from './ProfileDetailsForm'
import { ProfileIdentity } from './ProfileIdentity'

/**
 * Hồ sơ cá nhân `/ho-so` (LM-096, D-42): mọi người đã đăng nhập, mở từ menu tài khoản của thanh điều hướng hoặc của màn kho/tài xế.
 * Bố cục V2 hai cột: cột nhận diện (chữ viết tắt, tên, vai trò, email, kho — chỉ quản trị viên đổi) và một thẻ gồm hai mục form
 * phân cách bằng đường 1px: họ tên + số điện thoại, rồi đổi mật khẩu. Hẹp hơn 1.024 px thì dồn một cột, cột nhận diện lên trên.
 * Nhân viên kho và tài xế mở màn này trên máy cảm ứng nên chữ 16px, ô nhập và nút cao 56px khi con trỏ là ngón tay.
 */
export function ProfilePage() {
  const t = useT()
  const user = useCurrentUser()
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero title={t('profile.title')} description={t('pageHero.profile')} />
      <main className="min-h-0 flex-1 overflow-y-auto px-shell py-6 max-sm:p-4">
        <div className="grid max-w-300 grid-cols-1 items-start gap-6 pointer-coarse:text-body-lg lg:grid-cols-[272px_minmax(0,1fr)] lg:gap-8">
          <ProfileIdentity user={user} />
          <div className="flex min-w-0 flex-col gap-6 rounded-lg border border-border bg-bg p-6 max-sm:p-4">
            {/* `key`: đổi tài khoản trong cùng tab thì form dựng lại với dữ liệu của người mới */}
            <ProfileDetailsForm key={user.id} user={user} />
            <PasswordForm key={`${user.id}-mat-khau`} className="border-t border-border pt-6" />
          </div>
        </div>
      </main>
    </div>
  )
}
