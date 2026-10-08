import { useId, type ReactNode } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { TouchTopBar } from '@/components/TouchTopBar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { AccountMenu } from '@/features/auth/AccountMenu'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { NotificationBell } from '@/features/notifications/NotificationBell'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { MY_TRIP_GROUPS } from './my-trips'
import { MyTripCard } from './MyTripCard'
import { useMyTripsQuery } from './useDriverQueries'

/**
 * "Chuyến của tôi" `/tai-xe` (LM-087, D-46) — màn chính của tài xế: chuyến gán cho mình (từ FE-0-01 chỉ tài xế mở được) chia nhóm theo
 * trạng thái và dòng phụ (FE-6-01): Đang vận chuyển · Xếp xong — chờ xuất phát · Kho đang soạn / xếp (chỉ xem trước) · Đã giao gần đây
 * (5 chuyến). Điện thoại: chữ 16px, nút 56px. Nút thoát ở đây là đăng xuất; nút tài khoản mở hồ sơ cá nhân hoặc đăng xuất (LM-096);
 * chuông báo xác nhận tay của mình bị điều phối viên từ chối (FE-6-04). Dưới 480 px tiêu đề xuống hàng riêng: hàng trên chỉ đủ chỗ cho
 * bốn điều khiển 56 px.
 */
export function MyTripsPage() {
  const t = useT()
  const format = useFormat()
  return (
    <div className="flex h-dvh flex-col bg-app text-body-lg">
      {/* Dải trời với điều khiển đặc 56 px (V2.3 đợt 6): dưới 480 px tiêu đề xuống hàng riêng */}
      <TouchTopBar
        wrap
        leading={<ExitIconButton tone="sky" screenHome="/tai-xe" label={t('driver.exit')} iconClassName="size-7" />}
        trailing={
          <>
            <LanguageSwitch size="touch" tone="sky" className="flex-none [&>svg]:hidden min-[400px]:[&>svg]:block" />
            <NotificationBell variant="touch" tone="sky" />
            <AccountMenu tone="sky" />
          </>
        }
      >
        <div className="flex min-w-0 flex-col">
          <h1 className="font-display text-h1 leading-8 font-bold text-sky-text font-stretch-112%">{t('driver.list.title')}</h1>
          <p className="m-0 text-body-lg text-sky-text-3">{format.date(new Date())}</p>
        </div>
      </TouchTopBar>
      <main className="min-h-0 flex-1 overflow-y-auto px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+16px)]">
        <TripGroups />
      </main>
    </div>
  )
}

function TripGroups() {
  const t = useT()
  const query = useMyTripsQuery()
  if (query.isPending) {
    return <div role="status" aria-label={t('driver.loading')} className="grid h-full place-items-center"><Spinner /></div>
  }
  if (query.isError) {
    return (
      <Card>
        <EmptyState
          mascot="error"
          className="[&_span]:text-body-lg"
          title={t('driver.loadErrorTitle')}
          description={dataErrorMessage(query.error, t)}
          action={<Button variant="secondary" size="touch" onClick={() => void query.refetch()}>{t('driver.retry')}</Button>}
        />
      </Card>
    )
  }
  const trips = query.data
  if (MY_TRIP_GROUPS.every((group) => trips[group].length === 0)) {
    return (
      <Card>
        <EmptyState mascot="driverWaiting" className="[&_span]:text-body-lg" title={t('driver.list.emptyTitle')} description={t('driver.list.emptyDescription')} />
      </Card>
    )
  }
  // Một nút primary mỗi màn (mục 5): chuyến nên làm trước — đang giao dở, không thì chuyến đã xếp xong sớm nhất
  const primaryId = (trips.inTransit[0] ?? trips.loaded[0])?.id
  return (
    <div className="flex flex-col gap-6">
      {primaryId === undefined ? <p className="m-0 text-ink-2">{t('driver.list.noReady')}</p> : null}
      {MY_TRIP_GROUPS.map((group) => (trips[group].length === 0 ? null : (
        <Group key={group} title={t(`driver.list.groups.${group}`)}>
          {trips[group].map((row) => <MyTripCard key={row.id} row={row} primary={row.id === primaryId} />)}
        </Group>
      )))}
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-display text-h2 font-bold text-ink-strong font-stretch-106%">{title}</h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">{children}</ul>
    </section>
  )
}
