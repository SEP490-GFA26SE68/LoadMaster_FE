
import { Building2, Lock, Mail } from 'lucide-react'
import { RoleBadge } from '@/components/RoleBadge'
import { useT } from '@/lib/i18n'
import { initialsOf, type User } from '@/types/user'

/**
 * Thẻ nhận diện của Hồ sơ (V2.3).
 * Hiển thị họ tên, vai trò, email và kho trực thuộc.
 * Các thông tin này chỉ quản trị viên mới có thể thay đổi.
 */
export function ProfileIdentity({ user }: { user: User }) {
  const t = useT()

  const facts = [
    {
      label: t('profile.identity.email'),
      value: user.email,
      icon: Mail,
    },
    ...(user.depot
      ? [
          {
            label: t('profile.identity.depot'),
            value: user.depot,
            icon: Building2,
          },
        ]
      : []),
  ]

  return (
    <aside
      aria-label={t('profile.identity.label')}
      className="flex min-w-0 flex-col gap-5 rounded-lg border border-border bg-bg p-5 shadow-card"
    >
      <div className="flex min-w-0 flex-col items-start gap-3">
        <span
          aria-hidden
          className="grid size-16 flex-none place-items-center rounded-xl border border-cyan-200 bg-cyan-50 font-display text-h2 leading-none font-bold text-cyan-800"
        >
          {initialsOf(user.fullName)}
        </span>

        <h2 className="font-display text-h2 leading-7 font-bold tracking-[-0.2px] break-words text-ink-strong font-stretch-106%">
          {user.fullName}
        </h2>

        <span className="pointer-coarse:[&>span]:min-h-7 pointer-coarse:[&>span]:text-body-lg">
          <RoleBadge role={user.role} />
        </span>
      </div>

      <dl className="m-0 flex flex-col gap-3 border-t border-line-soft pt-4">
        {facts.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="flex min-w-0 flex-col gap-0.5"
          >
            <dt className="flex items-center gap-1.5 text-caption text-ink-3 pointer-coarse:text-body-lg">
              <Icon
                aria-hidden
                className="size-3.5 flex-none pointer-coarse:size-4"
                strokeWidth={1.5}
              />
              {label}
            </dt>

            <dd className="m-0 break-all text-ink-1">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <p className="flex items-start gap-2.5 rounded-md border border-line-soft bg-surface px-3 py-2.5 text-small text-ink-2 pointer-coarse:text-body-lg">
        <Lock
          aria-hidden
          className="mt-0.5 size-4 flex-none text-ink-3"
          strokeWidth={1.5}
        />
        <span>{t('profile.identity.note')}</span>
      </p>
    </aside>
  )
}
