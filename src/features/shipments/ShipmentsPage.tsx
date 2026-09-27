import { PackageCheck } from 'lucide-react'
import { ScreenShell } from '@/components/ScreenShell'
import { useT } from '@/lib/i18n'
import { useShipmentsQuery } from './useShipmentsQuery'

/** Lô hàng `/lo-hang` (luồng 1, LM-104). Khung màn: đếm lô của công ty; tạo lô, chọn logistics, bàn giao do bước giao diện dựng tiếp. */
export function ShipmentsPage() {
  const t = useT()
  const query = useShipmentsQuery()
  const count = query.data?.length ?? 0
  return (
    <ScreenShell
      title={t('sourcing.shipments.title')}
      description={t('pageHero.shipments')}
      icon={PackageCheck}
      loading={query.isPending}
      error={query.error}
      summary={count === 0 ? t('sourcing.shipments.empty') : t('sourcing.shipments.count', { count })}
    />
  )
}
