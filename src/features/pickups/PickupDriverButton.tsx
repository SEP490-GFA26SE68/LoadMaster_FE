import { PackagePlus } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useCan } from '@/features/auth/useCan'
import { useT } from '@/lib/i18n'
import { PickupRequestDialog } from './PickupRequestDialog'
import type { StopRef } from './pickup-stops'

/**
 * Lối gửi yêu cầu nhận hàng dọc đường của **tài xế** (FE-7-03, D-88): một nút phụ 56 px "Nhận hàng dọc đường" kèm hộp tạo yêu cầu cỡ
 * cảm ứng, tự chứa — màn điểm giao chỉ đặt nó cạnh các nút phụ khi chuyến đang vận chuyển. Không có quyền `pickups.create` thì không vẽ gì.
 */
export function PickupDriverButton({ tripId, stops }: { tripId: string; stops: readonly StopRef[] }) {
  const t = useT()
  const can = useCan()
  const [open, setOpen] = useState(false)
  if (!can('pickups.create')) return null
  return (
    <>
      <Button variant="secondary" size="touch" onClick={() => setOpen(true)}>
        <PackagePlus strokeWidth={2} />
        {t('pickups.open')}
      </Button>
      <PickupRequestDialog tripId={tripId} stops={stops} open={open} onOpenChange={setOpen} touch />
    </>
  )
}
