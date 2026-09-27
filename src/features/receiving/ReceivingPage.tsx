import { ScanLine } from 'lucide-react'
import { ScreenShell } from '@/components/ScreenShell'
import { useT } from '@/lib/i18n'
import { useIncomingShipmentsQuery } from './useReceivingQuery'

/**
 * Nhận hàng `/nhan-hang` (luồng 1, LM-104) — màn chính của công ty logistics. Khung màn: đếm kiện đang chờ quét nhận trong các lô bàn
 * giao cho công ty; quét QR (`QrScanDialog` + `useReceivePackageMutation`) do bước giao diện dựng tiếp.
 */
export function ReceivingPage() {
  const t = useT()
  const query = useIncomingShipmentsQuery()
  const count = query.data?.reduce((sum, row) => sum + row.pending.length, 0) ?? 0
  return (
    <ScreenShell
      title={t('sourcing.receiving.title')}
      description={t('pageHero.receiving')}
      icon={ScanLine}
      loading={query.isPending}
      error={query.error}
      summary={count === 0 ? t('sourcing.receiving.empty') : t('sourcing.receiving.count', { count })}
    />
  )
}
