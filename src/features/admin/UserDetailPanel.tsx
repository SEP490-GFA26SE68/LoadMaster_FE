import { Check, X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { permissionsOf } from '@/features/auth/permissions'
import { useT } from '@/lib/i18n'
import type { User } from '@/types/user'
import type { AccountGuards } from './account-guards'
import { UserDetailActions } from './UserDetailActions'
import { LastActive, RoleLabel, UserAvatar, UserCompany, UserDepot, UserStatusBadge } from './user-look'
import type { UserAction } from './UserRowMenu'

/**
 * Panel chi tiết người dùng (V2), cột phải của tab Tài khoản: danh tính (ô chữ viết tắt vuông bo góc, tên, email, vai trò, trạng thái),
 * thông tin cá nhân (chỉ những trường kho có), quyền của vai trò dựng từ `permissionsOf` và nút thao tác cùng luật với menu dòng.
 * Nền đặc, viền 1 px, không bóng — inspector là bề mặt đọc lâu, không dùng kính (AGENTS mục 5).
 * Mở hoặc đổi người thì con trỏ về tiêu đề panel (trình đọc màn hình đọc tên; dưới 1.280 px panel nằm dưới bảng nên cũng cuộn tới).
 */
export function UserDetailPanel({ id, user, guards, company, onAction, onClose }: {
  id: string
  user: User
  guards: AccountGuards
  /** Công ty của người dùng — chỉ truyền khi người xem là quản trị hệ thống (FE-0-08); `name` vắng khi kho chưa trả tên. */
  company?: { readonly id: string | undefined; readonly name: string | undefined }
  onAction: (action: UserAction, user: User) => void
  onClose: () => void
}) {
  const t = useT()
  const titleId = useId()
  const titleRef = useRef<HTMLHeadingElement>(null)
  const role = t(`roles.${user.role}`)

  useEffect(() => {
    titleRef.current?.focus()
  }, [user.id])

  return (
    <aside
      id={id}
      aria-label={t('admin.users.detail.region', { name: user.fullName })}
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-bg xl:sticky xl:top-0 xl:max-h-[calc(100dvh-217px)]"
    >
      <header className="flex flex-none items-start gap-3 border-b border-border py-4 pr-2 pl-4">
        <UserAvatar fullName={user.fullName} status={user.status} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <h2 ref={titleRef} id={titleId} tabIndex={-1} className="rounded-sm text-h3 font-semibold text-ink-strong outline-none">
            {user.fullName}
          </h2>
          <span className="max-w-full font-mono text-caption text-ink-3 wrap-anywhere">{user.email}</span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <RoleLabel role={user.role} />
            <UserStatusBadge status={user.status} />
          </span>
        </div>
        <button
          type="button"
          aria-label={t('admin.users.detail.close')}
          onClick={onClose}
          className="grid size-9 flex-none cursor-pointer place-items-center rounded-md text-ink-3 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        >
          <X className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </header>

      <div className="flex min-h-0 flex-col gap-6 overflow-y-auto p-4">
        <section aria-labelledby={`${titleId}-info`} className="flex flex-col gap-3">
          <h3 id={`${titleId}-info`} className="text-body font-semibold text-ink-strong">{t('admin.users.detail.info')}</h3>
          <dl className="flex flex-col gap-3">
            <Field label={t('admin.users.detail.id')}><span className="font-mono text-caption text-ink-1">{user.id}</span></Field>
            <Field label={t('admin.users.columns.phone')}><span className="font-mono text-caption text-ink-1">{user.phone}</span></Field>
            {company ? (
              <Field label={t('admin.users.columns.company')}><UserCompany companyId={company.id} name={company.name} /></Field>
            ) : null}
            <Field label={t('admin.users.columns.depot')}><UserDepot value={user.depot} /></Field>
            <Field label={t('admin.users.columns.lastActive')}><LastActive value={user.lastActiveAt} /></Field>
          </dl>
        </section>

        <section aria-labelledby={`${titleId}-permissions`} className="flex flex-col gap-2">
          <h3 id={`${titleId}-permissions`} className="text-body font-semibold text-ink-strong">{t('admin.users.detail.permissions')}</h3>
          <p className="text-caption text-ink-2">{t('admin.users.detail.permissionsNote', { role })}</p>
          <ul className="flex flex-wrap gap-1.5">
            {permissionsOf(user.role).map((permission) => (
              <li key={permission} className="flex items-center gap-1 rounded-sm border border-border bg-surface px-2 py-1 text-caption text-ink-1">
                <Check aria-hidden className="size-3 flex-none text-cyan-700" strokeWidth={2} />
                {t(`admin.permissions.labels.${permission}`)}
              </li>
            ))}
          </ul>
        </section>

        <UserDetailActions user={user} guards={guards} onAction={onAction} />
      </div>
    </aside>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-ink-3">{label}</dt>
      <dd className="text-body text-ink-1">{children}</dd>
    </div>
  )
}
