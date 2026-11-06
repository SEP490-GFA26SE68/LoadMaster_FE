import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n'
import { paymentPath, paymentResultPath } from './payment-path'
import type { PaymentStart } from './server-payment-api'

/**
 * Đi tiếp sau khi tạo thanh toán đăng ký hoặc nạp credit: kho mẫu mở trang thanh toán giả lập; cổng thử của backend mở trang xác nhận
 * `/thanh-toan/ket-qua`; cổng thật chuyển hẳn sang trang của cổng; gói miễn phí backend kích hoạt ngay nên chỉ báo đã kích hoạt.
 */
export function useOpenPayment() {
  const t = useT()
  const navigate = useNavigate()
  return (start: PaymentStart, planName = '') => {
    if (start.kind === 'simulation') void navigate(paymentPath(start.paymentId))
    else if (start.kind === 'confirm') void navigate(paymentResultPath(start.reference, start.purpose))
    else if (start.kind === 'redirect') window.location.assign(start.url)
    else toast.success(t('billing.activated', { plan: planName }))
  }
}
