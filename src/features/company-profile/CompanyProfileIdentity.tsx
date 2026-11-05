import { Building2, CalendarDays, Hash, Lock, Receipt, Warehouse, type LucideIcon } from 'lucide-react'
import { ServerCompanyStatusBadge } from '@/features/platform/server-companies-table'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { CompanyProfile } from './company-profile-api'

type Fact = { label: string; value: string; detail?: string; icon: LucideIcon; mono?: boolean }

/**
 * Thẻ nhận diện của Thông tin công ty — cùng bố cục với thẻ nhận diện của Hồ sơ: tên công ty, rồi những thông tin chỉ quản trị hệ
 * thống đổi được, kèm câu ghi chú. Máy chủ: mã công ty, mã số thuế, trạng thái, ngày tạo. Kho mẫu: mã công ty và kho xuất phát (máy chủ
 * chưa có kho). Tên đọc từ dữ liệu đã lưu, nên đổi theo sau khi lưu chứ không theo từng phím gõ.
 */
export function CompanyProfileIdentity({ profile }: { profile: CompanyProfile }) {
  const t = useT()
  const format = useFormat()
  const facts: Fact[] =
    profile.source === 'server'
      ? [
          { label: t('companyProfile.identity.code'), value: profile.company.code, icon: Hash, mono: true },
          ...(profile.company.taxCode ? [{ label: t('companyProfile.identity.taxCode'), value: profile.company.taxCode, icon: Receipt, mono: true }] : []),
          ...(profile.company.createdAt ? [{ label: t('companyProfile.identity.createdAt'), value: format.date(profile.company.createdAt), icon: CalendarDays }] : []),
        ]
      : [
          { label: t('companyProfile.identity.code'), value: profile.company.id, icon: Hash, mono: true },
          { label: t('companyProfile.identity.depot'), value: profile.company.depot.name, detail: profile.company.depot.address, icon: Warehouse },
        ]

  return (
    <aside aria-label={t('companyProfile.identity.label')} className="flex min-w-0 flex-col gap-5 rounded-lg border border-border bg-bg p-5 shadow-card">
      <div className="flex min-w-0 flex-col items-start gap-3">
        <span aria-hidden className="grid size-16 flex-none place-items-center rounded-xl border border-cyan-200 bg-cyan-50 text-cyan-800">
          <Building2 className="size-7" strokeWidth={1.5} />
        </span>
        <h2 className="font-display text-h2 leading-7 font-bold tracking-[-0.2px] wrap-break-word text-ink-strong font-stretch-106%">
          {profile.company.name}
        </h2>
        {profile.source === 'server' ? <ServerCompanyStatusBadge status={profile.company.status} /> : null}
      </div>

      <dl className="m-0 flex flex-col gap-3 border-t border-line-soft pt-4">
        {facts.map(({ label, value, detail, icon: Icon, mono }) => (
          <div key={label} className="flex min-w-0 flex-col gap-0.5">
            <dt className="flex items-center gap-1.5 text-caption text-ink-3">
              <Icon aria-hidden className="size-3.5 flex-none" strokeWidth={1.5} />
              {label}
            </dt>
            <dd className={cn('m-0 wrap-break-word text-ink-1', mono && 'font-mono tabular-nums')}>
              {value}
              {detail ? <span className="block text-small text-ink-3">{detail}</span> : null}
            </dd>
          </div>
        ))}
      </dl>

      <p className="flex items-start gap-2.5 rounded-md border border-line-soft bg-surface px-3 py-2.5 text-small text-ink-2">
        <Lock aria-hidden className="mt-0.5 size-4 flex-none text-ink-3" strokeWidth={1.5} />
        <span>{profile.source === 'server' ? t('companyProfile.identity.serverNote') : t('companyProfile.identity.note')}</span>
      </p>
    </aside>
  )
}
