import { TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { StatusBadge, TripSubStatusTag } from '@/components/StatusBadge'
import { VehicleName } from '@/components/VehicleName'
import { Button } from '@/components/ui/Button'
import { calendarDate } from '@/lib/calendar-date'
import { useFormat, useT } from '@/lib/i18n'
import { loadingSessionPath, type WarehouseTripRow } from './warehouse-trips'

const SUB_TOUCH = 'h-8 px-3 text-body-lg'

/**
 * Một chuyến ở danh sách kho: mã chuyến, trạng thái và dòng phụ, tuyến, ngày chạy, xe, số kiện, tiến độ và một nút 56px theo nhóm
 * (FE-6-01): "Bắt đầu soạn hàng" (chờ soạn), "Tiếp tục soạn / xếp (x/y)" (đang soạn, đang xếp — FE-6-02), "Xem chuyến đã xếp" (xếp
 * xong — còn ghi được số seal). Bản duyệt lỗi thời thì thay nút bằng cảnh báo — kho không làm theo phương án đã lệch dữ liệu (D-31);
 * chuyến vừa từ Đang xếp hàng quay về (bỏ kiện thiếu, kiện hỏng có kiện tựa lên) nói rõ lý do và có phải dỡ ra không. Chuyến có xác
 * nhận tay bị điều phối viên từ chối nói rõ còn kiện phải kiểm lại (FE-6-04).
 */
export function WarehouseTripCard({ row, primary }: { row: WarehouseTripRow; primary: boolean }) {
  const t = useT()
  const format = useFormat()
  const percent = row.total === 0 ? 0 : Math.round((row.recorded / row.total) * 100)
  const progress = `${format.integer(row.recorded)}/${format.integer(row.total)}`

  return (
    <li className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5 shadow-card md:flex-row md:items-center md:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="font-mono text-[18px] leading-6 font-semibold text-ink-1">{row.id}</h3>
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={row.status} className={SUB_TOUCH} />
            <TripSubStatusTag sub={row.sub} className={SUB_TOUCH} />
            <TripSubStatusTag sub={row.manualSub} className={SUB_TOUCH} />
          </span>
        </div>
        <p className="m-0 font-display text-h2 leading-6 font-bold text-pretty text-ink-strong font-stretch-106%">{row.name}</p>
        <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-2 lg:grid-cols-[1fr_1.7fr_0.8fr_1fr]">
          <Fact label={t('warehouse.list.date')}>{format.date(calendarDate(row.scheduledDate))}</Fact>
          <Fact label={t('warehouse.list.vehicle')}><VehicleName name={row.vehicleName} /></Fact>
          <Fact label={t('warehouse.list.packages')}><span className="font-mono">{format.integer(row.total)}</span></Fact>
          <Fact label={t('warehouse.list.progress')}>
            <span className="font-mono">{progress}</span>
            {row.damaged > 0 ? <span className="text-badge-warning-fg"> · {t('warehouse.list.damaged', { count: row.damaged })}</span> : null}
          </Fact>
        </dl>
        {row.stage === 'loading' ? (
          <div className="flex items-center gap-3">
            <div
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('warehouse.list.progressLabel', { tripId: row.id })}
              className="h-2.5 flex-1 overflow-hidden rounded-full bg-n-100"
            >
              <div className="h-full rounded-full bg-(image:--meter-fill)" style={{ width: `${percent}%` }} />
            </div>
            <span aria-hidden className="w-12 text-right font-display text-body-lg font-[650] text-ink-2 tabular-nums">{format.integer(percent)}%</span>
          </div>
        ) : null}
        {row.stage === 'loaded' ? (
          <p className="m-0 text-text-2">{row.seal === undefined ? t('warehouse.list.noSeal') : t('warehouse.list.seal', { number: row.seal })}</p>
        ) : null}
        {row.recheck > 0 ? <Warning tone="danger">{t('warehouse.list.recheck', { count: row.recheck })}</Warning> : null}
        {row.stage === 'stale' ? (
          <Warning tone="warning">
            {row.replan === undefined ? t('warehouse.list.stale') : t(`warehouse.replan.${row.replan.reason}`, { tripId: row.id })}
            {row.replan?.unload ? ` ${t('warehouse.replan.unload')}` : ''}
          </Warning>
        ) : null}
      </div>
      {row.stage === 'stale' ? null : (
        // Cột phải: nút theo nhóm. Nút chính của màn cao 64 px, nút phụ 56 px (mục 10) — cùng một cột để mắt tìm việc kế tiếp
        <div className="flex flex-none flex-col md:w-72">
          <Button asChild variant={primary ? 'primary' : 'secondary'} size="touch" className={primary ? 'h-16 w-full' : 'w-full'}>
            <Link to={loadingSessionPath(row.id)}>
              {row.stage === 'loading'
                ? t(`warehouse.list.resume.${row.step}`, { done: format.integer(row.recorded), total: format.integer(row.total) })
                : row.stage === 'loaded' ? t('warehouse.list.openLoaded') : t('warehouse.list.start')}
            </Link>
          </Button>
        </div>
      )}
    </li>
  )
}

function Warning({ tone, children }: { tone: 'warning' | 'danger'; children: ReactNode }) {
  const box = tone === 'danger'
    ? 'border-badge-danger-border bg-badge-danger-bg text-badge-danger-fg'
    : 'border-badge-warning-border bg-badge-warning-bg text-badge-warning-fg'
  return (
    <p className={`m-0 flex items-start gap-3 rounded-lg border px-4 py-3 font-medium ${box}`}>
      <TriangleAlert className="mt-0.5 size-5 flex-none" strokeWidth={2} aria-hidden />
      {children}
    </p>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-ink-3">{label}</dt>
      <dd className="m-0 font-medium text-ink-strong">{children}</dd>
    </div>
  )
}
