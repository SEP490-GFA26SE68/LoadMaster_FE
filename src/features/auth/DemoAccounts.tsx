import { ChevronRight } from 'lucide-react'
import { useId } from 'react'
import { RoleBadge } from '@/components/RoleBadge'
import { useT } from '@/lib/i18n'
import { DEMO_GROUPS, DEMO_PASSWORD } from './auth.mock'

/**
 * Bảng tài khoản dùng thử, chỉ có ý nghĩa khi chạy dữ liệu mẫu: chia nhóm theo nền tảng và từng công ty (FE-0-03), mỗi dòng là một
 * vai trò — bấm thì điền email và mật khẩu vào form. Xoá component này cùng lúc với việc nối backend xác thực thật.
 *
 * V2.3 (`DangNhap.jpg`): vai trò là `RoleBadge` (icon + tên), email mono, mũi tên chỉ việc bấm. Từ 1.024 px hộp **tự cuộn trong card**:
 * đầu hộp đứng yên, danh sách nhóm cuộn trong phần còn lại của card (`min-h-0 flex-1`), nên màn đăng nhập không phải cuộn cả trang;
 * hẹp hơn thì hộp cao theo nội dung và trang cuộn như thường. Dòng là nút `min-h-9` (cảm ứng: 56px, chữ 16px) có tên truy cập là
 * "vai trò + email", như trước.
 */
export function DemoAccounts({
  onPick,
}: {
  onPick: (email: string, password: string) => void
}) {
  const t = useT()
  const labelId = useId()

  return (
    <div className="flex flex-none flex-col overflow-hidden rounded-lg border border-dashed border-line-strong bg-surface lg:min-h-48 lg:flex-1">
      <div className="flex flex-none flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-3.5 pt-3 pb-2">
        <span className="text-caption font-semibold text-ink-2 pointer-coarse:text-body-lg">{t('auth.demo.title')}</span>
        <span className="font-mono text-caption text-ink-3 pointer-coarse:text-body">
          {t('auth.demo.password', { password: DEMO_PASSWORD })}
        </span>
      </div>

      <div className="flex flex-col gap-2 px-2 pb-2.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {DEMO_GROUPS.map((group) => (
          <div key={group.id} role="group" aria-labelledby={`${labelId}-${group.id}`} className="flex flex-col gap-0.5">
            <span id={`${labelId}-${group.id}`} className="px-1.5 pt-1 text-caption font-semibold text-ink-3 pointer-coarse:text-body">
              {group.company ?? t('auth.demo.platform')}
            </span>
            <ul className="m-0 flex list-none flex-col p-0">
              {group.hints.map((hint) => (
                <li key={hint.email}>
                  <button
                    type="button"
                    onClick={() => onPick(hint.email, DEMO_PASSWORD)}
                    className="flex min-h-9 w-full items-center justify-between gap-3 rounded-md px-1.5 py-1 text-left pointer-coarse:flex-col pointer-coarse:items-start pointer-coarse:justify-center pointer-coarse:gap-1 pointer-coarse:py-2 transition-colors duration-(--dur-fast) ease-standard hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary pointer-coarse:min-h-16"
                  >
                    {/* Nhãn vai trò phóng lên 16px khi con trỏ là ngón tay (mục 10) — `RoleBadge` không có cỡ cảm ứng */}
                    <span className="flex min-w-0 pointer-coarse:[&>span]:min-h-7 pointer-coarse:[&>span]:text-body-lg">
                      <RoleBadge role={hint.role} />
                    </span>
                    <span className="flex min-w-0 items-center gap-1.5 pointer-coarse:w-full pointer-coarse:justify-between">
                      <span className="truncate font-mono text-caption text-ink-2 pointer-coarse:text-body">{hint.email}</span>
                      <ChevronRight aria-hidden className="size-4 flex-none text-ink-3" strokeWidth={1.5} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}
