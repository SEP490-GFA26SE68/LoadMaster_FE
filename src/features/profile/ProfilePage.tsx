import { PageHero } from '@/components/PageHero'
import { useCurrentUser } from '@/features/auth/AuthProvider'
import { useT } from '@/lib/i18n'
import { PasswordForm } from './PasswordForm'
import { ProfileDetailsForm } from './ProfileDetailsForm'
import { ProfileIdentity } from './ProfileIdentity'

/**
 * Hồ sơ cá nhân `/ho-so` (LM-096, D-42): mọi người đã đăng nhập, mở từ menu tài khoản của thanh điều hướng hoặc của màn kho/tài xế.
 * Bố cục V2.3 (`HoSo.jpg`): thẻ nhận diện bên trái (chữ viết tắt, tên, vai trò, email, kho — chỉ quản trị viên đổi) và hai thẻ form riêng
 * bên phải — thông tin cá nhân, rồi đổi mật khẩu. Hẹp hơn 1.024 px thì dồn một cột, thẻ nhận diện lên trên.
 * Nhân viên kho và tài xế mở màn này trên máy cảm ứng nên chữ 16px, ô nhập và nút cao 56px khi con trỏ là ngón tay.
 */
export function ProfilePage() {
  const t = useT()
  const user = useCurrentUser()
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero title={t('profile.title')} description={t('pageHero.profile')} overlap />
      {/* Thứ đầu tiên của vùng cuộn là thẻ nền đặc nên được đè lên dải trời (`sky-overlap`) */}
      <main className="sky-overlap min-h-0 flex-1 overflow-y-auto px-shell pb-6 max-sm:px-4">
        <div className="grid grid-cols-1 items-start gap-4 pointer-coarse:text-body-lg lg:grid-cols-[288px_minmax(0,1fr)] lg:gap-5">
          <ProfileIdentity user={user} />
          <div className="flex min-w-0 flex-col gap-4 lg:gap-5">
            {/* `key`: đổi tài khoản trong cùng tab thì form dựng lại với dữ liệu của người mới */}
            <ProfileDetailsForm key={user.id} user={user} />
            <PasswordForm key={`${user.id}-mat-khau`} />
          </div>
        </div>
      </main>
    </div>
  )
}
