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
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { useWarehouseTripsQuery } from './useWarehouseQueries'
import { warehouseGroups, type WarehouseStage, type WarehouseTripRow } from './warehouse-trips'
import { WarehouseTripCard } from './WarehouseTripCard'

/**
 * Màn chính của nhân viên kho (LM-086, D-46). Chuyến chia nhóm theo trạng thái và dòng phụ (FE-6-01): Đang xếp hàng (tiến độ) · Chờ
 * soạn (Đã lập kế hoạch, phương án đã duyệt còn hiệu lực) · Xếp xong — chờ xuất phát · Chờ điều phối tối ưu lại (bản duyệt lỗi thời,
 * không bắt đầu được). Máy tính bảng: thẻ cỡ cảm ứng, nút 56px, chữ ≥ 16px (mục 10). Nút thoát ở đây là đăng xuất với nhân viên kho;
 * nút tài khoản mở hồ sơ cá nhân hoặc đăng xuất (LM-096). Nút "Tra cứu kiện" mở `/tra-cuu-kien` (FE-3b-06).
 */
export function WarehouseTripsPage() {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  // Cùng khoá truy vấn với danh sách bên dưới: không thêm lần đọc kho nào
  const query = useWarehouseTripsQuery()
  return (
    <div className="flex h-dvh flex-col bg-app text-body-lg">
      {/* Dải trời với điều khiển đặc (V2.3 đợt 6): kính chưa đo ở thiết bị kho */}
      <TouchTopBar
        leading={<ExitIconButton tone="sky" screenHome="/kho" label={t('warehouse.exit')} iconClassName="size-7" />}
        trailing={
          <>
            {/* Tra cứu kiện (FE-3b-06): nút phụ 56 px; dưới 1.024 px chỉ còn icon để tiêu đề không bị cắt, tên ở `aria-label` */}
            {can('packages.lookup') ? (
              <Button asChild variant="skySolid" size="touch" className="flex-none max-lg:w-14 max-lg:px-0">
                <Link to="/tra-cuu-kien" aria-label={t('warehouse.list.lookup')}>
                  <ScanLine strokeWidth={1.5} />
                  <span className="max-lg:hidden">{t('warehouse.list.lookup')}</span>
                </Link>
              </Button>
            ) : null}
            <LanguageSwitch size="touch" tone="sky" className="flex-none" />
            {/* Chuông (FE-6-04): xác nhận tay của mình bị điều phối viên từ chối */}
            <NotificationBell variant="touch" tone="sky" />
            <AccountMenu tone="sky" />
          </>
        }
      >
        {/* Logo ở màn chính của kho (LM-105); phiên xếp giữ thanh gọn cho một thao tác mỗi màn */}
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

/** Trạng thái rỗng nằm trong card trắng, chữ 16px như phần còn lại của màn tablet (mô tả của `EmptyState` mặc định 14px). */
const TOUCH_EMPTY = 'mx-auto w-full max-w-160 [&_span+span]:text-body-lg'

function TripList() {
  const t = useT()
  const query = useWarehouseTripsQuery()
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
        <EmptyState mascot="warehouseWaiting" title={t('warehouse.list.emptyTitle')} description={t('warehouse.list.emptyDescription')} />
      </Card>
    )
  }
  // Một nút primary mỗi màn (mục 5): chuyến nên làm trước — đang xếp dở, không thì chuyến chờ soạn sớm nhất
  const primaryId = query.data.find((row) => row.stage === 'loading' || row.stage === 'waiting')?.id
  return (
    <div className="mx-auto flex w-full max-w-(--shell-max) flex-col gap-6">
      {warehouseGroups(query.data).map((group) => <TripGroup key={group.stage} stage={group.stage} rows={group.rows} primaryId={primaryId} />)}
    </div>
  )
}

/** Một nhóm chuyến theo trạng thái: tiêu đề nhóm và danh sách thẻ mang cùng tên. */
function TripGroup({ stage, rows, primaryId }: { stage: WarehouseStage; rows: readonly WarehouseTripRow[]; primaryId: string | undefined }) {
  const t = useT()
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-display text-h2 font-bold text-ink-strong font-stretch-106%">{t(`warehouse.list.groups.${stage}`)}</h2>
      <ul aria-labelledby={id} className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((row) => <WarehouseTripCard key={row.id} row={row} primary={row.id === primaryId} />)}
      </ul>
    </section>
  )
}
