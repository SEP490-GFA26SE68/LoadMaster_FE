import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { StatusBadge } from '@/components/StatusBadge'
import { VehicleName } from '@/components/VehicleName'
import { Button } from '@/components/ui/Button'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { useStartServerLoadingMutation } from './useServerWarehouseQuery'
import type { ServerWarehouseTrip } from './warehouse-server-api'
import { loadingSessionPath } from './warehouse-trips'

/**
 * Một chuyến ở danh sách kho bản máy chủ: mã chuyến, trạng thái, giờ xuất phát, xe, số kiện và một nút 56 px theo nhóm — "Bắt đầu xếp hàng"
 * (chờ xếp: máy chủ chuyển chuyến sang Đang xếp hàng và trả danh sách kiện), "Tiếp tục xếp" (mở lại phiên của máy chủ, ở
 * thiết bị nào cũng được), "Xem chuyến đã xếp"; chuyến chờ điều phối tối ưu lại chỉ có một dòng lý do, không nút. Máy chủ không trả tên tuyến, tiến độ, seal: không vẽ.
 */
export function ServerWarehouseTripCard({ row, primary }: { row: ServerWarehouseTrip; primary: boolean }) {
  const t = useT()
  const format = useFormat()
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-border bg-bg p-5 shadow-card md:flex-row md:items-center md:gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <h3 className="font-mono text-[18px] leading-6 font-semibold text-ink-1">{row.code}</h3>
          <StatusBadge status={row.status} className="h-8 px-3 text-body-lg" />
        </div>
        {row.stage === 'stale' ? (
          <p className="m-0 text-pretty font-medium text-badge-warning-fg">{t(`serverWarehouse.replan.${row.replanReason ?? 'unknown'}`)}</p>
        ) : null}
        <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-2 lg:grid-cols-[1fr_2fr_0.8fr]">
          <Fact label={t('serverWarehouse.departure')}>
            {row.departureAt === null ? t('serverWarehouse.unknown') : `${format.time(row.departureAt)} · ${format.date(row.departureAt)}`}
          </Fact>
          <Fact label={t('serverWarehouse.vehicle')}>{row.vehicle === '' ? t('serverWarehouse.unknown') : <VehicleName name={row.vehicle} />}</Fact>
          <Fact label={t('serverWarehouse.packages')}>
            <span className="font-mono">{row.packageCount === null ? t('serverWarehouse.unknown') : format.integer(row.packageCount)}</span>
          </Fact>
        </dl>
      </div>
      {row.stage === 'stale' ? null : (
        <div className="flex flex-none flex-col md:w-72">
          {row.stage === 'waiting' ? <StartButton tripId={row.id} primary={primary} /> : (
            <Button asChild variant={primary ? 'primary' : 'secondary'} size="touch" className={primary ? 'h-16 w-full' : 'w-full'}>
              <Link to={loadingSessionPath(row.id)}>{t(row.stage === 'loading' ? 'serverWarehouse.resume' : 'serverWarehouse.openLoaded')}</Link>
            </Button>
          )}
        </div>
      )}
    </li>
  )
}

function StartButton({ tripId, primary }: { tripId: string; primary: boolean }) {
  const t = useT()
  const navigate = useNavigate()
  const start = useStartServerLoadingMutation(tripId)
  function handleStart() {
    start.mutate(undefined, {
      onSuccess: () => void navigate(loadingSessionPath(tripId)),
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }
  return (
    <Button variant={primary ? 'primary' : 'secondary'} size="touch" className={primary ? 'h-16 w-full' : 'w-full'} loading={start.isPending} onClick={handleStart}>
      {t('serverWarehouse.start')}
    </Button>
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
