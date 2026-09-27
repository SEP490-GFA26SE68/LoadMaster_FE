import { ClipboardList } from 'lucide-react'
import { ScreenShell } from '@/components/ScreenShell'
import { useT } from '@/lib/i18n'
import { useOrdersQuery } from './useOrdersQuery'

/** Đơn hàng `/don-hang` (luồng 2, LM-104). Khung màn: đếm đơn chờ gán chuyến; tạo đơn và gán vào điểm giao do bước giao diện dựng tiếp. */
export function OrdersPage() {
  const t = useT()
  const query = useOrdersQuery()
  const rows = query.data ?? []
  const pending = rows.filter((row) => row.order.status === 'pending').length
  return (
    <ScreenShell
      title={t('orders.title')}
      description={t('pageHero.orders')}
      meta={rows.length > 0 ? t('orders.count', { count: rows.length }) : undefined}
      icon={ClipboardList}
      loading={query.isPending}
      error={query.error}
      summary={rows.length === 0 ? t('orders.empty') : t('orders.pendingCount', { count: pending })}
    />
  )
}
