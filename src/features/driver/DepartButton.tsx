import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { useStartDeliveryMutation } from './useDriverQueries'

/**
 * "Xuất phát" ở thẻ chuyến Đang xếp hàng khi màn tài xế đọc backend (`departFromList`): máy chủ không nói kho đã xếp xong chưa, nên tài
 * xế bấm và máy chủ quyết — kho chưa xong thì toast nói lý do (`LOADING_NOT_COMPLETED`), không đổi gì; xong thì mở điểm giao đầu tiên.
 */
export function DepartButton({ tripId, href, primary }: { tripId: string; href: string; primary: boolean }) {
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
    <Button variant={primary ? 'primary' : 'secondary'} size="touch" block loading={start.isPending} onClick={handleDepart}>
      {t('driver.backend.depart')}
    </Button>
  )
}
