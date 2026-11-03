import { FileSignature, Lock, TriangleAlert } from 'lucide-react'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import type { CompanyAgreement } from './agreements-api'

export function TrialAgreementBanner({
  agreement,
  onOpenSignDialog,
}: {
  agreement?: CompanyAgreement | null
  onOpenSignDialog: () => void
}) {
  if (!agreement) return null

  if (agreement.status === 'EXPIRED' || agreement.isExpired) {
    return (
      <Banner
        tone="danger"
        icon={Lock}
        className="shadow-sm"
      >
        <div className="flex flex-col gap-0.5">
          <span className="font-bold text-red-950">
            Thỏa thuận đã quá hạn 3 ngày — Tài khoản đã bị tạm khóa
          </span>
          <span className="text-small text-red-800">
            Thời hạn 72 giờ để hoàn tất ký thỏa thuận dịch vụ thử nghiệm đã kết thúc. Vui lòng liên hệ quản trị viên nền tảng hoặc bộ phận hỗ trợ khách hàng để được mở khóa tài khoản.
          </span>
        </div>
      </Banner>
    )
  }

  if (agreement.status === 'PENDING') {
    return (
      <Banner
        tone="warning"
        icon={TriangleAlert}
        className="shadow-sm"
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={onOpenSignDialog}
            className="bg-amber-600 hover:bg-amber-700 text-white border-none shadow-sm"
          >
            <FileSignature className="mr-1.5 size-4" />
            Ký thỏa thuận ngay
          </Button>
        }
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-amber-950">
              Yêu cầu bắt buộc: Ký Thỏa thuận Dịch vụ Thử nghiệm
            </span>
            <span className="rounded-full bg-amber-200/80 px-2 py-0.5 font-mono text-fine font-semibold text-amber-900">
              Còn {agreement.hoursRemaining} giờ
            </span>
          </div>
          <span className="text-small text-amber-900">
            Theo quy định, Quý khách cần hoàn tất ký thỏa thuận điện tử trong vòng 3 ngày kể từ khi được kích hoạt tài khoản. Nếu không ký trong thời gian này, tài khoản công ty sẽ tự động bị khóa dù thời hạn dùng thử vẫn còn.
          </span>
        </div>
      </Banner>
    )
  }

  return null
}
