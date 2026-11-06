import { ScanLine } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router'
import { LogoMark } from '@/components/brand/LogoMark'
import { EmptyState } from '@/components/EmptyState'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { TouchTopBar } from '@/components/TouchTopBar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { AccountMenu } from '@/features/auth/AccountMenu'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { useCan } from '@/features/auth/useCan'
import { packagePoolReachable } from '@/features/package-pool/usePackagePoolQuery'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { ServerWarehouseTripCard } from './ServerWarehouseTripCard'
import { useServerWarehouseTripsQuery } from './useServerWarehouseQuery'
import type { ServerWarehouseStage, ServerWarehouseTrip } from './warehouse-server-api'

const STAGES: readonly ServerWarehouseStage[] = ['loading', 'waiting', 'loaded', 'stale']

/** Trạng thái rỗng nằm trong card trắng, chữ 16px như phần còn lại của màn tablet. */
const TOUCH_EMPTY = 'mx-auto w-full max-w-160 [&_span+span]:text-body-lg'

/**
 * Màn chính của nhân viên kho khi nhóm `warehouse` nối backend: chuyến chờ xếp và chuyến Đang xếp hàng của công ty (`GET /api/warehouse/tasks`),
 * chia nhóm Đang xếp hàng · Chờ xếp · Xếp xong — chờ xuất phát · Chờ điều phối tối ưu lại (phiên dừng vì kiện thiếu / hỏng, chỉ xem). Cùng thanh dải trời, nút 56 px, chữ 16 px với
 * bản kho mẫu; không có chuông (backend chưa có thông báo cho kho).
 */
export function ServerWarehouseTripsPage() {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const query = useServerWarehouseTripsQuery()
  return (
    <div className="flex h-dvh flex-col bg-app text-body-lg">
      <TouchTopBar
        leading={<ExitIconButton tone="sky" screenHome="/kho" label={t('warehouse.exit')} iconClassName="size-7" />}
        trailing={
          <>
            {can('packages.lookup') && packagePoolReachable(can) ? (
              <Button asChild variant="skySolid" size="touch" className="flex-none max-lg:w-14 max-lg:px-0">
                <Link to="/tra-cuu-kien" aria-label={t('warehouse.list.lookup')}>
                  <ScanLine strokeWidth={1.5} />
                  <span className="max-lg:hidden">{t('warehouse.list.lookup')}</span>
                </Link>
              </Button>
            ) : null}
            <LanguageSwitch size="touch" tone="sky" className="flex-none" />
            <AccountMenu tone="sky" />
          </>
        }
      >
        <LogoMark tone="dark" className="size-9" />
        <div className="flex min-w-0 flex-col">
          <h1 className="truncate font-display text-h1 leading-8 font-bold text-sky-text font-stretch-112%">{t('warehouse.list.title')}</h1>
          {query.data ? (
            <p className="m-0 truncate text-body-lg text-sky-text-3">
              {t('warehouse.list.summary', { count: query.data.length, date: format.date(new Date()) })}
            </p>
          ) : null}
        </div>
      </TouchTopBar>
      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <TripList />
      </main>
    </div>
  )
}

function TripList() {
  const t = useT()
  const query = useServerWarehouseTripsQuery()
  if (query.isPending) {
    return <div role="status" aria-label={t('warehouse.loading')} className="grid h-full place-items-center"><Spinner /></div>
  }
  if (query.isError) {
    return (
      <Card className={TOUCH_EMPTY}>
        <EmptyState
          mascot="error"
          title={t('warehouse.loadErrorTitle')}
          description={dataErrorMessage(query.error, t)}
          action={<Button variant="secondary" size="touch" onClick={() => void query.refetch()}>{t('warehouse.retry')}</Button>}
        />
      </Card>
    )
  }
  if (query.data.length === 0) {
    return (
      <Card className={TOUCH_EMPTY}>
        <EmptyState mascot="warehouseWaiting" title={t('serverWarehouse.emptyTitle')} description={t('serverWarehouse.emptyDescription')} />
      </Card>
    )
  }
  // Một nút primary mỗi màn: chuyến đang xếp dở, không thì chuyến chờ xếp sớm nhất
  const primaryId = (query.data.find((row) => row.stage === 'loading') ?? query.data.find((row) => row.stage === 'waiting'))?.id
  return (
    <div className="mx-auto flex w-full max-w-(--shell-max) flex-col gap-6">
      {STAGES.map((stage) => {
        const rows = query.data.filter((row) => row.stage === stage)
        return rows.length === 0 ? null : <TripGroup key={stage} stage={stage} rows={rows} primaryId={primaryId} />
      })}
    </div>
  )
}

function TripGroup({ stage, rows, primaryId }: { stage: ServerWarehouseStage; rows: readonly ServerWarehouseTrip[]; primaryId: string | undefined }) {
  const t = useT()
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-display text-h2 font-bold text-ink-strong font-stretch-106%">{t(`serverWarehouse.groups.${stage}`)}</h2>
      <ul aria-labelledby={id} className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row) => <ServerWarehouseTripCard key={row.id} row={row} primary={row.id === primaryId} />)}
      </ul>
    </section>
  )
}
