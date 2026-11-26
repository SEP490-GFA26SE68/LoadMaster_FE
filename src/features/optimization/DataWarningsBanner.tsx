import { Link } from 'react-router'

import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { useAuthSafe } from '@/features/auth/AuthProvider'
import { can } from '@/features/auth/permissions'
import { useFormat, useT } from '@/lib/i18n'

import type { DataWarning } from './data-warnings'

/** Số mã kiện liệt kê mỗi cảnh báo; còn lại gói vào "và n kiện khác". */
const SHOWN_CODES = 5

/**
 * Cảnh báo dữ liệu của lần chạy tối ưu máy chủ — không chặn: mỗi loại một câu kèm số kiện, rồi mã kiện khi biết (`codes`: mã số → mã in
 * trên nhãn, từ các phương án của lần chạy); không biết mã nào thì chỉ có số. Lối sửa theo quyền người xem: Kho kiện (`packages.view`) và
 * Loại kiện (`packages.manage`); ngoài `AuthProvider` thì không có lối nào. Không có cảnh báo thì không vẽ gì.
 */
export function DataWarningsBanner({ warnings, codes, className }: {
  warnings: readonly DataWarning[]
  codes?: ReadonlyMap<string, string>
  className?: string
}) {
  const t = useT()
  const format = useFormat()
  const role = useAuthSafe()?.user?.role
  if (warnings.length === 0) return null
  const links = [
    can(role, 'packages.view') ? { to: '/kien-hang', label: t('physicalData.warnings.openPackages') } : null,
    can(role, 'packages.manage') ? { to: '/loai-kien', label: t('physicalData.warnings.openPackageTypes') } : null,
  ].filter((link) => link !== null)

  return (
    <Banner tone="warning" className={className}>
      <div data-data-warnings className="flex flex-col gap-2">
        <p className="font-medium">{t('physicalData.warnings.title')}</p>
        <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5">
          {warnings.map((warning) => {
            const known = warning.packageIds.flatMap((id) => {
              const code = codes?.get(id)
              return code ? [code] : []
            })
            const shown = known.slice(0, SHOWN_CODES)
            const rest = warning.packageIds.length - shown.length
            return (
              <li key={warning.code}>
                {t(`physicalData.warnings.${warning.code}`, { count: warning.packageIds.length })}
                {shown.length === 0 ? null : (
                  <span className="block text-small text-ink-2">
                    {t('physicalData.warnings.codes', {
                      codes: format.list(rest > 0 ? [...shown, t('physicalData.warnings.more', { count: rest })] : shown),
                    })}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
        {links.length === 0 ? null : (
          <div className="flex flex-wrap gap-2">
            {links.map((link) => (
              <Button key={link.to} variant="secondary" size="sm" asChild>
                <Link to={link.to}>{link.label}</Link>
              </Button>
            ))}
          </div>
        )}
      </div>
    </Banner>
  )
}
