import { useId } from 'react'
import { useT } from '@/lib/i18n'
import { DEMO_GROUPS, DEMO_PASSWORD } from './auth.mock'

/**
 * Bảng tài khoản dùng thử, chỉ có ý nghĩa khi chạy dữ liệu mẫu: chia nhóm theo nền tảng và từng công ty (FE-0-03), mỗi dòng là một
 * vai trò — bấm thì điền email và mật khẩu vào form. Xoá component này cùng lúc với việc nối backend xác thực thật.
 */
export function DemoAccounts({
  onPick,
}: {
  onPick: (email: string, password: string) => void
}) {
  const t = useT()
  const labelId = useId()

  return (
    <div className="flex flex-col gap-3 rounded-md border border-dashed border-switch-off bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-caption font-medium text-text-2">{t('auth.demo.title')}</span>
        <span className="font-mono text-caption text-text-3">
          {t('auth.demo.password', { password: DEMO_PASSWORD })}
        </span>
      </div>

      {DEMO_GROUPS.map((group) => (
        <div key={group.id} role="group" aria-labelledby={`${labelId}-${group.id}`} className="flex flex-col gap-0.5">
          <span id={`${labelId}-${group.id}`} className="px-2 text-caption font-semibold text-text-2">
            {group.company ?? t('auth.demo.platform')}
          </span>
          <ul className="m-0 flex list-none flex-col p-0">
            {group.hints.map((hint) => (
              <li key={hint.email}>
                <button
                  type="button"
                  onClick={() => onPick(hint.email, DEMO_PASSWORD)}
                  className="flex w-full items-baseline justify-between gap-3 rounded-sm px-2 py-1.5 text-left transition-colors duration-(--dur-fast) ease-standard hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  <span className="text-body font-medium text-text">
                    {t(`roles.${hint.role}`)}
                  </span>
                  <span className="truncate font-mono text-caption text-text-3">
                    {hint.email}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
