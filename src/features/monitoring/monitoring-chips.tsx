import { Badge, type BadgeTone } from '@/components/ui/Badge'
import type { DeadlineStatus } from '@/domain/routing'
import { useT } from '@/lib/i18n'
import type { LocationSource, TripExceptionStatus } from '@/lib/mock-db'

/** Chip dùng chung của màn Giám sát (FE-6-10 → FE-6-12): mức hạn, nguồn vị trí, trạng thái sự cố. */

const DEADLINE_TONE: Readonly<Record<DeadlineStatus, BadgeTone>> = { OK: 'success', AT_RISK: 'warning', MISSED: 'danger' }

/** Mức hạn của một điểm (hoặc mức xấu nhất của chuyến); `null` là không điểm nào có hạn. Màu luôn đi kèm chữ. */
export function DeadlineChip({ status }: { status: DeadlineStatus | null | undefined }) {
  const t = useT()
  if (status === null || status === undefined) return <Badge tone="neutral">{t('monitoring.list.noDeadline')}</Badge>
  return <Badge tone={DEADLINE_TONE[status]} dot={status === 'OK' ? 'solid' : 'halo'}>{t(`common.deadlineStatuses.${status}`)}</Badge>
}

/** Nguồn của vị trí: "Mô phỏng" hay "GPS" — nhãn luôn đi kèm mọi chỗ hiện vị trí. */
export function SourceTag({ source }: { source: LocationSource }) {
  const t = useT()
  return <Badge shape="tag" tone={source === 'GPS' ? 'success' : 'neutral'}>{t(`monitoring.location.sources.${source}`)}</Badge>
}

const EXCEPTION_TONE: Readonly<Record<TripExceptionStatus, BadgeTone>> = { OPEN: 'warning', ESCALATED: 'azure', RESOLVED: 'success' }

/** Trạng thái sự cố: chưa xử lý hổ phách có quầng (cần người xử lý), đã chuyển quản lý xanh lam vòng rỗng (chờ người kế tiếp), đã xử lý xanh lá. */
export function ExceptionStatusChip({ status }: { status: TripExceptionStatus }) {
  const t = useT()
  return (
    <Badge tone={EXCEPTION_TONE[status]} dot={status === 'OPEN' ? 'halo' : status === 'ESCALATED' ? 'ring' : 'solid'}>
      {t(`monitoring.exceptions.statuses.${status}`)}
    </Badge>
  )
}
