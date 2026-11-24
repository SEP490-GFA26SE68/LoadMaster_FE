import { Ellipsis, TrafficCone, type LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/Dialog'
import { useCan } from '@/features/auth/useCan'
import { ReportExceptionDialog } from '@/features/monitoring/ReportExceptionDialog'
import { useT } from '@/lib/i18n'
import { useDriverCapabilities } from './useDriverQueries'

type Panel = 'menu' | 'exception' | null

/**
 * Nút phụ "Thêm" ở màn điểm giao của tài xế khi chuyến đang vận chuyển (V2.3 đợt 6): việc ít dùng trên đường nằm trong **một** tờ trượt
 * từ đáy — "Sự cố trên đường" (`exceptions.report`, FE-6-11: sự cố của cả xe, kèm số phút chậm; khác "Báo sự cố" của từng kiện). Hàng giữ
 * nguyên quyền của nó và mở đúng hộp thoại cũ (cỡ cảm ứng); không có quyền thì không vẽ nút. Trạng thái "đang mở gì" nằm ở đây để tờ
 * đóng lại rồi hộp thoại mới mở. Hàng còn theo nguồn dữ liệu (`DRIVER_CAPABILITIES`); `tripLabel` là mã chuyến hiện trên tiêu đề hộp
 * thoại khi `tripId` là mã số của máy chủ.
 */
export function StopMoreActions({ tripId, tripLabel }: { tripId: string; tripLabel?: string }) {
  const t = useT()
  const can = useCan()
  const caps = useDriverCapabilities()
  const [panel, setPanel] = useState<Panel>(null)
  const canException = can('exceptions.report') && caps.tripExceptions
  if (!canException) return null
  const close = (open: boolean) => { if (!open) setPanel(null) }
  return (
    <>
      <Button variant="secondary" size="touch" aria-haspopup="dialog" onClick={() => setPanel('menu')}>
        <Ellipsis strokeWidth={2} />
        {t('driver.more.open')}
      </Button>
      <Dialog open={panel === 'menu'} onOpenChange={close}>
        <DialogContent sheet className="w-[min(30rem,calc(100vw-3rem))]">
          <div className="flex flex-col gap-1 px-5 pt-3 md:pt-6">
            <DialogTitle className="font-display text-h2 leading-6.5 font-bold text-ink-strong font-stretch-106%">{t('driver.more.title')}</DialogTitle>
            <DialogDescription className="text-body-lg text-pretty text-ink-2">{t('driver.more.description')}</DialogDescription>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2 p-5">
            <li><Row icon={TrafficCone} label={t('monitoring.reportDialog.driverOpen')} onClick={() => setPanel('exception')} /></li>
          </ul>
        </DialogContent>
      </Dialog>
      <ReportExceptionDialog tripId={tripId} tripLabel={tripLabel} open={panel === 'exception'} onOpenChange={close} touch serverRecorded={caps.backend} />
    </>
  )
}

function Row({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) {
  return (
    <Button variant="secondary" size="touch" block className="justify-start gap-3" onClick={onClick}>
      <Icon strokeWidth={2} />
      {label}
    </Button>
  )
}
