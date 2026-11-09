import { UserCheck, UserX, Users, type LucideIcon } from 'lucide-react'
import { KpiTile, type KpiTone } from '@/components/KpiTile'
import { useFormat, useT } from '@/lib/i18n'
import type { UserScope } from '@/lib/mock-db'
import type { User, UserStatus } from '@/types/user'
import { userSummary } from './user-summary'

const SUMMARY_STATUSES = ['active', 'suspended'] as const satisfies readonly UserStatus[]

/** Icon và tint theo nghĩa cố định (AGENTS mục 4): sẵn sàng → xanh lá, cần chú ý → hổ phách; tổng là ngữ cảnh → slate. */
const STATUS_TILE: Record<'active' | 'suspended', { icon: LucideIcon; tone: KpiTone }> = {
  active: { icon: UserCheck, tone: 'green' },
  suspended: { icon: UserX, tone: 'amber' },
}

/**
 * Ba ô số liệu trên đầu tab Tài khoản (V2): tổng tài khoản, đang hoạt động, đã khoá — đếm trên **toàn bộ** người dùng của kho
 * (không theo ô tìm). Hai ô trạng thái là công tắc lọc: bấm thì lọc theo trạng thái đó, bấm lại ô đang lọc thì bỏ lọc — đi qua
 * cùng bộ lọc `trang-thai` trên URL với ô chọn trạng thái, nên hai nơi luôn khớp nhau (như Đội xe).
 */
export function UsersSummary({ users, status, scope, onStatusChange }: {
  users: readonly User[]
  status: string
  scope?: UserScope
  onStatusChange: (status: string) => void
}) {
  const t = useT()
  const format = useFormat()
  const summary = userSummary(users)
  const isCompany = scope === 'company'

  return (
    <div className="grid flex-none grid-cols-1 gap-3 md:grid-cols-3">
      <KpiTile
        icon={Users}
        tone="slate"
        label={isCompany ? t('admin.employees.summary.total') : t('admin.users.summary.total')}
        value={format.integer(summary.total)}
        note={isCompany ? t('admin.employees.summary.totalNote') : t('admin.users.summary.totalNote')}
      />
      {SUMMARY_STATUSES.map((value) => {
        const pressed = status === value
        return (
          <KpiTile
            key={value}
            icon={STATUS_TILE[value].icon}
            tone={STATUS_TILE[value].tone}
            label={t(`admin.users.status.${value}`)}
            value={format.integer(summary[value])}
            note={t(`admin.users.summary.note.${value}`)}
            pressed={pressed}
            onPress={() => onStatusChange(pressed ? '' : value)}
          />
        )
      })}
    </div>
  )
}
