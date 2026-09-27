import { PackageCheck } from 'lucide-react'
import { useParams } from 'react-router'
import { ScreenShell } from '@/components/ScreenShell'
import { useT } from '@/lib/i18n'
import { useShipmentQuery } from './useShipmentsQuery'

/** Chi tiết lô `/lo-hang/:shipmentId` (luồng 1, LM-104). Khung màn: số kiện trong lô và số đã nhận; bảng kiện do bước giao diện dựng tiếp. */
export function ShipmentDetailPage() {
  const t = useT()
  const { shipmentId = '' } = useParams()
  const query = useShipmentQuery(shipmentId)
  const count = query.data?.shipment.packageIds.length ?? 0
  return (
    <ScreenShell
      title={t('titles.shipment', { id: shipmentId })}
      description={t('pageHero.shipment')}
      icon={PackageCheck}
      loading={query.isPending}
      error={query.error}
      summary={t('sourcing.shipments.detailCount', { count, received: query.data?.receivedCount ?? 0 })}
    />
  )
}
