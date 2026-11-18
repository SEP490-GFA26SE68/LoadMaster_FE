import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import type { ServerLoadingSession } from './warehouse-server-api'
import { WarehouseEmpty } from './WarehouseEmpty'

/**
 * Phiên bản máy chủ đã xếp xong, chuyến chờ tài xế xuất phát (mở lại phiên sau khi xuất phát là màn "Không mở được phiên xếp"). Nút về
 * danh sách chuyến là nút chính duy nhất.
 */
export function ServerLoadingFinished({ tripId, session }: { tripId: string; session: ServerLoadingSession }) {
  const t = useT()
  const damaged = Object.values(session.outcomes).filter((outcome) => outcome === 'damaged').length
  return (
    <WarehouseEmpty
      tripId={tripId}
      label={session.code}
      mascot="done"
      title={t('serverWarehouse.session.finishedTitle', { code: session.code })}
      description={damaged > 0
        ? `${t('serverWarehouse.session.finishedDescription')} ${t('serverWarehouse.session.finishedDamaged', { count: damaged })}`
        : t('serverWarehouse.session.finishedDescription')}
      action={
        <Button asChild size="touch" className="w-full max-w-120">
          <Link to="/kho">{t('warehouse.backToList')}</Link>
        </Button>
      }
    />
  )
}
