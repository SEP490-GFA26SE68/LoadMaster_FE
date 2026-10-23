
import { Warehouse } from 'lucide-react'
import { KpiTile } from '@/components/KpiTile'
import { useFormat, useT } from '@/lib/i18n'

/**
 * Thống kê đội xe lấy từ API thật.
 *
 * totalElements là tổng số xe trên BE,
 * không phải số xe trong trang hiện tại.
 *
 * Các ô trạng thái sẽ bổ sung khi có API
 * trạng thái xe thực tế.
 */
export function FleetSummary({
  totalElements,
}: {
  totalElements: number
}) {
  const t = useT()
  const format = useFormat()

  return (
    <div className="grid flex-none grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile
        icon={Warehouse}
        tone="slate"
        label={t('fleet.summary.total')}
        value={format.integer(totalElements)}
        note={t('fleet.summary.totalNote')}
      />
    </div>
  )
}
