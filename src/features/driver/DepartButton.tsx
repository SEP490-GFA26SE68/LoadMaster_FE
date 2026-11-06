import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { useStartDeliveryMutation } from './useDriverQueries'

/**
 * "Xuất phát" ở thẻ chuyến Đang xếp hàng khi màn tài xế đọc backend (`departFromList`): bật khi máy chủ báo kho đã xếp xong
 * (`loadingCompleted`), không thì mờ kèm lý do ngay trên nút (`blockedBy` — mã của dòng lý do). Máy chủ vẫn từ chối thì toast nói lý do,
 * không đổi gì; xong thì mở điểm giao đầu tiên.
 */
export function DepartButton({ tripId, href, primary, blockedBy }: { tripId: string; href: string; primary: boolean; blockedBy?: string }) {
  const t = useT()
  const navigate = useNavigate()
  const start = useStartDeliveryMutation(tripId)
  function handleDepart() {
    start.mutate(undefined, {
      onSuccess: () => void navigate(href),
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }
  return (
    <Button variant={primary ? 'primary' : 'secondary'} size="touch" block loading={start.isPending} disabled={blockedBy !== undefined}
      aria-describedby={blockedBy} onClick={handleDepart}>
      {t('driver.backend.depart')}
    </Button>
  )
}
