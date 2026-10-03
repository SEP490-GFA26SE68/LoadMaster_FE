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

export function ProfileIdentity({ user }: { user: User }) {
  const t = useT()

  const facts = [
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
        <span
          aria-hidden
          className="grid size-14 flex-none place-items-center rounded-lg border border-primary/25 bg-primary-bg text-h3 font-semibold leading-none text-primary-hover"
        >
          {initialsOf(user.fullName)}
        </span>

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
          </div>
        ))}
      </dl>

      <p className="text-ink-2">
        {t('profile.identity.note')}
      </p>
    </aside>
  )
}