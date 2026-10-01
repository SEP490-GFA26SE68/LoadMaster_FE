import { Badge } from '@/components/ui/Badge'
import { useT } from '@/lib/i18n'
import { initialsOf, type User } from '@/types/user'

/**
 * Cột nhận diện của Hồ sơ (V2): chữ viết tắt, họ tên, vai trò, rồi những thông tin chỉ quản trị viên đổi được (email, kho trực
 * thuộc). Email chỉ hiện ở đây — form bên cạnh không lặp lại. Không thêm lần đăng nhập, thiết bị hay xác thực hai bước: kho không
 * có nguồn cho chúng. Tên đọc từ người dùng của phiên, nên đổi theo sau khi lưu chứ không theo từng phím gõ.
 */
export function ProfileIdentity({ user }: { user: User }) {
  const t = useT()
  // Người dùng nền tảng không thuộc kho nào (FE-0-03): không có dòng kho thay vì một dòng trống
  const facts = [
    { label: t('profile.identity.email'), value: user.email },
    ...(user.depot ? [{ label: t('profile.identity.depot'), value: user.depot }] : []),
  ]

  return (
    <aside aria-label={t('profile.identity.label')} className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-0 lg:pt-2">
      <div className="flex min-w-0 items-center gap-4 lg:flex-col lg:items-start lg:gap-3">
        <span
          aria-hidden
          className="grid size-14 flex-none place-items-center rounded-lg border border-primary/25 bg-primary-bg text-h3 font-semibold leading-none text-primary-hover"
        >
          {initialsOf(user.fullName)}
        </span>
        <div className="flex min-w-0 flex-col items-start gap-2">
          <h2 className="text-h2 font-semibold break-words text-ink-strong">{user.fullName}</h2>
          {/* Chữ 16px khi con trỏ là ngón tay (mục 10) */}
          <Badge tone="info" className="pointer-coarse:h-7 pointer-coarse:text-body-lg">{t(`roles.${user.role}`)}</Badge>
        </div>
      </div>

      {/* Một cột khi cột nhận diện đứng cạnh form; khi dồn lên trên form thì hai thông tin nằm cạnh nhau cho đỡ cao */}
      <dl className="m-0 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-1">
        {facts.map(({ label, value }) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-caption text-ink-3 pointer-coarse:text-body-lg">{label}</dt>
            <dd className="m-0 break-all text-ink-1">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-ink-2">{t('profile.identity.note')}</p>
    </aside>
  )
}
