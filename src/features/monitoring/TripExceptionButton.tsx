import { TrafficCone } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useCan } from '@/features/auth/useCan'
import { useT } from '@/lib/i18n'
import { ReportExceptionDialog } from './ReportExceptionDialog'

/**
 * Lối báo sự cố cấp chuyến của **tài xế** (FE-6-11, D-87): một nút phụ 56 px "Sự cố trên đường" kèm hộp báo sự cố cỡ cảm ứng, tự chứa
 * — màn điểm giao chỉ đặt nó cạnh các nút phụ khi chuyến đang giao. Khác "Báo sự cố" của từng kiện (hàng hỏng, thiếu hàng): đây là việc
 * xảy ra với cả xe trên đường, kèm số phút dự kiến chậm. Không có quyền `exceptions.report` thì không vẽ gì.
 */
export function TripExceptionButton({ tripId }: { tripId: string }) {
  const t = useT()
  const can = useCan()
  const [open, setOpen] = useState(false)
  if (!can('exceptions.report')) return null
  return (
    <>
      <Button variant="secondary" size="touch" onClick={() => setOpen(true)}>
        <TrafficCone strokeWidth={2} />
        {t('monitoring.reportDialog.driverOpen')}
      </Button>
      <ReportExceptionDialog tripId={tripId} open={open} onOpenChange={setOpen} touch />
    </>
  )
}
