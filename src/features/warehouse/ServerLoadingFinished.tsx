import { Link } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { SealPanel } from './SealCard'
import { useRecordServerSealMutation } from './useServerWarehouseQuery'
import type { ServerLoadingSession } from './warehouse-server-api'
import { WarehouseEmpty } from './WarehouseEmpty'

/**
 * Phiên bản máy chủ đã xếp xong, chuyến chờ tài xế xuất phát: máy chủ còn cho ghi / đổi số seal tới lúc xe rời kho (mở lại phiên sau khi
 * xuất phát là màn "Không mở được phiên xếp"). Chưa ghi seal thì nút ghi là nút chính, lối về danh sách là nút phụ (một nút chính mỗi màn).
 */
export function ServerLoadingFinished({ tripId, session }: { tripId: string; session: ServerLoadingSession }) {
  const t = useT()
  const record = useRecordServerSealMutation(tripId)
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
        <div className="flex w-full max-w-120 flex-col gap-4 text-left">
          <SealPanel
            seal={session.seal}
            editable
            pending={record.isPending}
            onSubmit={(number, done) => record.mutate(number, { onSuccess: done, onError: (error) => toast.error(dataErrorMessage(error, t)) })}
          />
          <Button asChild variant={session.seal ? 'primary' : 'secondary'} size="touch" className="w-full">
            <Link to="/kho">{t('warehouse.backToList')}</Link>
          </Button>
        </div>
      }
    />
  )
}
