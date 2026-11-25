import { ArrowLeft, RotateCw } from 'lucide-react'
import { Component, type ReactNode } from 'react'
import { Link } from 'react-router'
import { ErrorScreen } from '@/app/ErrorScreen'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'

/**
 * Chặn lỗi lúc vẽ Planner 3D (bản kho mẫu lẫn bản máy chủ, kể cả lỗi R3F ném lên từ trong Canvas): hiện màn lỗi của Planner thay cho
 * trang trắng hay màn lỗi chung của router. Nơi dùng đặt `key` theo chuyến và phương án đang xem để đổi phương án là thử vẽ lại.
 */
export class PlannerErrorBoundary extends Component<{ tripId: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <PlannerCrashScreen tripId={this.props.tripId} /> : this.props.children
  }
}

/** Màn lỗi của Planner: không chi tiết kỹ thuật (luật `ErrorScreen`); về Chi tiết chuyến là nút chính, tải lại trang là nút phụ. */
export function PlannerCrashScreen({ tripId }: { tripId: string }) {
  const t = useT()
  return (
    <ErrorScreen
      code={t('plannerRecovery.crash.code')}
      mascot="error"
      title={t('plannerRecovery.crash.title')}
      description={t('plannerRecovery.crash.description')}
      actions={<>
        <Button variant="primary" asChild>
          <Link to={tripId ? `/chuyen/${encodeURIComponent(tripId)}` : '/chuyen'}>
            <ArrowLeft aria-hidden strokeWidth={1.5} />
            {t('plannerRecovery.crash.backToTrip')}
          </Link>
        </Button>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          <RotateCw aria-hidden strokeWidth={1.5} />
          {t('plannerRecovery.crash.reload')}
        </Button>
      </>}
    />
  )
}
