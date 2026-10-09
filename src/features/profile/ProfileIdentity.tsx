<<<<<<< HEAD
import { Badge } from '@/components/ui/Badge'
import { useT, type MessageKey } from '@/lib/i18n'
import { initialsOf, type User } from '@/types/user'

const ROLE_LABEL_KEYS = {
  systemAdmin: 'roles.systemAdmin',
  systemManager: 'roles.systemManager',
  systemSupporter: 'roles.systemSupporter',
  companyAdmin: 'roles.companyAdmin',
  companyManager: 'roles.companyManager',
  dispatcher: 'roles.dispatcher',
  warehouse: 'roles.warehouse',
  driver: 'roles.driver',
} as const satisfies Record<User['role'], MessageKey>

=======
import { Building2, Lock, Mail } from 'lucide-react'
import { RoleBadge } from '@/components/RoleBadge'
import { useT } from '@/lib/i18n'
import { initialsOf, type User } from '@/types/user'

/**
 * Thẻ nhận diện của Hồ sơ (V2.3 `HoSo.jpg`): chữ viết tắt trong ô vuông bo góc (ảnh đại diện trong nội dung là ô vuông, hình tròn chỉ ở
 * nút tài khoản), họ tên Archivo, nhãn vai trò, rồi những thông tin chỉ quản trị viên đổi được (email, kho trực thuộc) kèm icon và câu
 * ghi chú. Email chỉ hiện ở đây — form bên cạnh không lặp lại. Không thêm lần đăng nhập, thiết bị hay xác thực hai bước: kho không
 * có nguồn cho chúng. Tên đọc từ người dùng của phiên, nên đổi theo sau khi lưu chứ không theo từng phím gõ.
 */
>>>>>>> 34cc3a7ac8a1fdcb0057169d78e306f2e97aa291
export function ProfileIdentity({ user }: { user: User }) {
  const t = useT()

  const facts = [
<<<<<<< HEAD
    { label: t('profile.identity.email'), value: user.email },
    ...(user.depot
      ? [{ label: t('profile.identity.depot'), value: user.depot }]
      : []),
  ]

  return (
    <aside
      aria-label={t('profile.identity.label')}
      className="flex min-w-0 flex-col gap-5 lg:sticky lg:top-0 lg:pt-2"
    >
      <div className="flex min-w-0 items-center gap-4 lg:flex-col lg:items-start lg:gap-3">
=======
    { label: t('profile.identity.email'), value: user.email, icon: Mail },
    ...(user.depot ? [{ label: t('profile.identity.depot'), value: user.depot, icon: Building2 }] : []),
  ]

  return (
    <aside aria-label={t('profile.identity.label')} className="flex min-w-0 flex-col gap-5 rounded-lg border border-border bg-bg p-5 shadow-card">
      <div className="flex min-w-0 flex-col items-start gap-3">
>>>>>>> 34cc3a7ac8a1fdcb0057169d78e306f2e97aa291
        <span
          aria-hidden
          className="grid size-16 flex-none place-items-center rounded-xl border border-cyan-200 bg-cyan-50 font-display text-h2 leading-none font-bold text-cyan-800"
        >
          {initialsOf(user.fullName)}
        </span>
<<<<<<< HEAD

        <div className="flex min-w-0 flex-col items-start gap-2">
          <h2 className="text-h2 font-semibold break-words text-ink-strong">
            {user.fullName}
          </h2>

          <Badge
            tone="info"
            className="pointer-coarse:h-7 pointer-coarse:text-body-lg"
          >
            {t(ROLE_LABEL_KEYS[user.role])}
          </Badge>
        </div>
      </div>

      <dl className="m-0 grid gap-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-1">
        {facts.map(({ label, value }) => (
          <div
            key={label}
            className="flex min-w-0 flex-col gap-0.5"
          >
            <dt className="text-caption text-ink-3 pointer-coarse:text-body-lg">
              {label}
            </dt>
            <dd className="m-0 break-all text-ink-1">
              {value}
            </dd>
=======
        <h2 className="font-display text-h2 leading-7 font-bold tracking-[-0.2px] break-words text-ink-strong font-stretch-106%">
          {user.fullName}
        </h2>
        <span className="pointer-coarse:[&>span]:min-h-7 pointer-coarse:[&>span]:text-body-lg">
          <RoleBadge role={user.role} />
        </span>
      </div>

      <dl className="m-0 flex flex-col gap-3 border-t border-line-soft pt-4">
        {facts.map(({ label, value, icon: Icon }) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1.5 text-caption text-ink-3 pointer-coarse:text-body-lg">
              <Icon aria-hidden className="size-3.5 flex-none pointer-coarse:size-4" strokeWidth={1.5} />
              {label}
            </dt>
            <dd className="m-0 break-all text-ink-1">{value}</dd>
>>>>>>> 34cc3a7ac8a1fdcb0057169d78e306f2e97aa291
          </div>
        ))}
      </dl>

<<<<<<< HEAD
      <p className="text-ink-2">
        {t('profile.identity.note')}
=======
      <p className="flex items-start gap-2.5 rounded-md border border-line-soft bg-surface px-3 py-2.5 text-small text-ink-2 pointer-coarse:text-body-lg">
        <Lock aria-hidden className="mt-0.5 size-4 flex-none text-ink-3" strokeWidth={1.5} />
        <span>{t('profile.identity.note')}</span>
>>>>>>> 34cc3a7ac8a1fdcb0057169d78e306f2e97aa291
      </p>
    </aside>
  )
}