import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import type { OptimizationResult } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'

/**
 * Thanh trên của Planner (LM-049, LM-094). Cao 56px — bản mỏng dành riêng cho màn 3D (AGENTS mục 5). Từ 1.366 px đây là
 * **hàng điều khiển duy nhất** (D-51): mã chuyến, MOCK RESULT, chỉ số, điều khiển mô phỏng (`controls`), rồi trạng thái duyệt và
 * hành động (`children`); hẹp hơn thì điều khiển mô phỏng xuống thanh công cụ riêng. Số lấy thẳng từ `result.metrics` của
 * revision; thời gian chạy nằm ở tab Chỉ số của hộp thông tin để hàng này vừa 1.366 px.
 */
export function ViewerHeader({ tripId, metrics, placedCount, totalCount, isMockResult, manuallyEdited, controls, children }: {
  tripId: string
  metrics: OptimizationResult['metrics'] | null
  placedCount: number
  totalCount: number
  /** Spec: mọi kết quả từ mock mang nhãn MOCK RESULT, không dịch. */
  isMockResult: boolean
  /** Revision đang xem đã mang chỉnh tay (khi đã có chỉnh sửa mới, nút "Duyệt bản chỉnh" nói thay). */
  manuallyEdited: boolean
  /** Điều khiển mô phỏng gộp vào hàng này từ 1.366 px; vắng ở chế độ Chỉnh sửa. */
  controls?: ReactNode
  /** Trạng thái duyệt và hành động, bên phải. */
  children: ReactNode
}) {
  const t = useT()
  const format = useFormat()
  return (
    <header className="flex h-14 flex-none items-center gap-2 border-b border-border bg-bg px-2 xl:px-4">
      <Link
        to={`/chuyen/${tripId}`}
        aria-label={t('viewer.header.back')}
        className="grid size-14 shrink-0 place-items-center rounded-md text-text-2 transition-colors duration-(--dur-fast) ease-standard hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary xl:size-11"
      >
        <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
      </Link>

      <h1 className="hidden shrink-0 font-mono text-[18px] leading-6 font-semibold tracking-[-0.02em] whitespace-nowrap xl:block">{tripId}</h1>
      {/* Hai nhãn của kết quả xếp chồng (22 + 4 + 22 px vừa hàng 56 px): hàng gộp vừa 1.366 px cả khi bản đã duyệt có chỉnh tay */}
      {isMockResult || manuallyEdited ? (
        <div className="flex shrink-0 flex-col items-start gap-1">
          {isMockResult ? <Badge shape="tag" tone="mock">MOCK RESULT</Badge> : null}
          {manuallyEdited ? <Badge shape="tag" tone="azure">{t('viewer.plan.manuallyEdited')}</Badge> : null}
        </div>
      ) : null}

      <dl className="hidden shrink-0 items-center gap-3 pl-1 xl:flex">
        {metrics ? <>
          <Stat label={t('viewer.plan.volume')}><span className="font-semibold text-primary">{format.percent(metrics.volumeUtilizationPercent)}</span></Stat>
          <Stat label={t('viewer.plan.payload')}>{format.percent(metrics.payloadUtilizationPercent)}</Stat>
        </> : null}
        <Stat label={t('viewer.plan.placed')}>
          {format.integer(placedCount)} <span className="font-normal text-text-3">/ {format.integer(totalCount)}</span>
        </Stat>
      </dl>

      {controls ? (
        <div className="ml-1 hidden min-w-0 items-center gap-2 border-l border-border pl-3 min-[1366px]:flex" data-planner-controls>
          {controls}
        </div>
      ) : null}

      <div className="flex-1" />
      {children}
    </header>
  )
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-[11px] leading-3.5 text-text-3">{label}</dt>
      <dd className="font-mono text-body leading-4.5 font-medium whitespace-nowrap">{children}</dd>
    </div>
  )
}
