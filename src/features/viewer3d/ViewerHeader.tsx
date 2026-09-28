import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Badge } from '@/components/ui/Badge'
import type { OptimizationResult } from '@/domain/models'
import { useFormat, useT } from '@/lib/i18n'

/**
 * Thanh trên của Planner (LM-049, LM-094; V2.3 LM-107). Kính tối cao 56 px — bản mỏng dành riêng cho màn 3D (AGENTS mục 5), từ `xl`
 * nổi cách mép 14 px và bo góc như `Planner3D.jpg`. Từ 1.366 px đây là **hàng điều khiển duy nhất** (D-51): quay lại, tên tuyến +
 * mã chuyến · revision và nhãn của kết quả (MOCK RESULT, Đã chỉnh tay, Lỗi thời, LIFO tắt), chỉ số, điều khiển mô phỏng (`controls`),
 * rồi trạng thái duyệt và hành động (`children`); hẹp hơn thì điều khiển mô phỏng xuống thanh công cụ riêng. Số lấy thẳng từ
 * `result.metrics` của revision; thời gian chạy nằm ở tab Chỉ số của hộp thông tin để hàng này vừa 1.366 px.
 */
export function ViewerHeader({ tripId, title, revisionId, metrics, placedCount, totalCount, isMockResult, manuallyEdited, stale = false, lifoOff = false, controls, children }: {
  tripId: string
  /** Tên tuyến của chuyến; vắng (fixture benchmark) thì tiêu đề là mã chuyến. */
  title?: string
  /** Revision đang xem; `null` với fixture benchmark. */
  revisionId: string | null
  metrics: OptimizationResult['metrics'] | null
  placedCount: number
  totalCount: number
  /** Spec: mọi kết quả từ mock mang nhãn MOCK RESULT, không dịch. */
  isMockResult: boolean
  /** Revision đang xem đã mang chỉnh tay (khi đã có chỉnh sửa mới, nút "Duyệt bản chỉnh" nói thay). */
  manuallyEdited: boolean
  /** Xe hoặc kiện đổi sau lần tối ưu này (thanh thông báo bên dưới nói chi tiết). */
  stale?: boolean
  /** Lần chạy tắt "Bắt buộc thứ tự dỡ theo điểm giao" (`request.settings.enforceLifo`). */
  lifoOff?: boolean
  /** Điều khiển mô phỏng gộp vào hàng này từ 1.366 px; vắng ở chế độ Chỉnh sửa. */
  controls?: ReactNode
  /** Trạng thái duyệt và hành động, bên phải. */
  children: ReactNode
}) {
  const t = useT()
  const format = useFormat()
  const codes = revisionId ? `${tripId} · ${revisionId}` : tripId
  return (
    <div className="flex-none xl:px-3.5 xl:pt-3.5">
      <header className="glass-dark flex h-14 items-center gap-2 px-2 xl:gap-2.5 xl:rounded-2xl xl:pr-2.5 2xl:gap-3">
        <Link
          to={`/chuyen/${tripId}`}
          aria-label={t('viewer.header.back')}
          className="grid size-14 shrink-0 place-items-center rounded-md border border-sky-glass-border bg-sky-glass text-glass-dark-text transition-colors duration-(--dur-fast) ease-standard hover:bg-sky-glass-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300 xl:size-10"
        >
          <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
        </Link>

        {/* Không cắt chữ bằng dấu ba chấm (AGENTS mục 5, `layout-1366`): tên tuyến dài chỉ hiện từ 1.680 px; hẹp hơn tiêu đề là mã
            chuyến và dòng dưới chỉ còn mã revision (LM-107) */}
        <div className="flex min-w-0 flex-[0_1_25rem] flex-col gap-1.5">
          <h1 className="hidden font-display text-h3 leading-5 font-bold whitespace-nowrap text-sky-text font-stretch-106% md:block" title={title ?? tripId}>
            {title ? (
              <>
                <span className="hidden min-[1680px]:inline">{title}</span>
                <span className="font-mono text-body min-[1680px]:hidden">{tripId}</span>
              </>
            ) : tripId}
          </h1>
          {/* Dưới 1.536 px chỉ còn mã và MOCK RESULT: font Linux của CI rộng hơn, hàng nhãn đủ ba tag tràn ở 1.366 px. "Đã chỉnh tay" còn ở
              panel chỉnh sửa, Lỗi thời và LIFO tắt ở thanh thông báo / hộp thoại Duyệt; điện thoại không có tên tuyến và mã */}
          <div className="flex min-w-0 flex-col items-start gap-1 md:flex-row md:items-center md:gap-2">
            <span className="hidden font-mono text-caption leading-4 whitespace-nowrap text-cyan-200 md:inline">
              {title ? <><span className="hidden min-[1680px]:inline">{codes}</span><span className="min-[1680px]:hidden">{revisionId ?? tripId}</span></> : codes}
            </span>
            {isMockResult ? <Badge shape="tag" tone="mock" className="border-amber-500/45 text-amber-500">MOCK RESULT</Badge> : null}
            {manuallyEdited ? <Badge shape="tag" tone="azure" className="hidden bg-azure-500/20 text-azure-200 2xl:inline-flex">{t('viewer.plan.manuallyEdited')}</Badge> : null}
            {stale ? <Badge shape="tag" outlined className="hidden border-amber-500/40 bg-amber-500/15 text-amber-200 2xl:inline-flex">{t('viewer.plan.staleTag')}</Badge> : null}
            {lifoOff ? <Badge shape="tag" outlined className="hidden border-sky-glass-border bg-sky-glass text-glass-dark-text 2xl:inline-flex">{t('viewer.plan.lifoOff')}</Badge> : null}
          </div>
        </div>

        {metrics || totalCount > 0 ? <Separator /> : null}
        <dl className="hidden shrink-0 items-center gap-3.5 xl:flex">
          {metrics ? <>
            <Stat label={t('viewer.plan.volume')}>{format.percent(metrics.volumeUtilizationPercent)}</Stat>
            <Stat label={t('viewer.plan.payload')}>{format.percent(metrics.payloadUtilizationPercent)}</Stat>
          </> : null}
          <Stat label={t('viewer.plan.placed')}>
            {format.integer(placedCount)} <span className="text-caption font-medium text-glass-dark-muted">/ {format.integer(totalCount)}</span>
          </Stat>
        </dl>

        {controls ? (
          <div className="hidden shrink-0 items-center gap-2 min-[1366px]:flex" data-planner-controls>
            <Separator />
            {controls}
          </div>
        ) : null}

        <div className="flex-1" />
        {children}
      </header>
    </div>
  )
}

function Separator() {
  return <span aria-hidden className="hidden h-7.5 w-px flex-none bg-glass-dark-border xl:block" />
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-note leading-3.5 text-glass-dark-muted">{label}</dt>
      <dd className="font-display text-h3 leading-4 font-semibold whitespace-nowrap text-sky-text tabular-nums">{children}</dd>
    </div>
  )
}
