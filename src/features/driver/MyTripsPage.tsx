import { useId, type ReactNode } from 'react'
import { EmptyState } from '@/components/EmptyState'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { AccountMenu } from '@/features/auth/AccountMenu'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { MyTripCard } from './MyTripCard'
import { useMyTripsQuery } from './useDriverQueries'

/**
 * "Chuyến của tôi" `/tai-xe` (LM-087, D-46) — màn chính của tài xế: chuyến gán cho mình (quản trị thấy mọi chuyến) chia ba nhóm: sẵn
 * sàng giao, kho đang chuẩn bị (không bấm được), đã hoàn thành gần đây. Điện thoại: chữ 16px, nút 56px. Nút thoát ở đây là đăng xuất;
 * nút tài khoản mở hồ sơ cá nhân hoặc đăng xuất (LM-096).
 */
export function MyTripsPage() {
  const t = useT()
  return (
    <div className="flex h-dvh flex-col bg-bg text-body-lg">
      <header className="flex flex-none items-center gap-1.5 border-b border-border bg-bg px-4 pt-[calc(env(safe-area-inset-top)+12px)] pb-3">
        <ExitIconButton screenHome="/tai-xe" label={t('driver.exit')} className="-ml-2" iconClassName="size-6" />
        <h1 className="min-w-0 flex-1 text-h2 font-semibold">{t('driver.list.title')}</h1>
        <LanguageSwitch size="touch" className="flex-none [&>svg]:hidden min-[400px]:[&>svg]:block" />
        <AccountMenu className="-mr-2" />
      </header>
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
      <EmptyState
        mascot="error"
        className="[&_span]:text-body-lg"
        title={t('driver.loadErrorTitle')}
        description={dataErrorMessage(query.error, t)}
        action={<Button variant="secondary" size="touch" onClick={() => void query.refetch()}>{t('driver.retry')}</Button>}
      />
    )
  }
  const { ready, preparing, recent } = query.data
  if (ready.length + preparing.length + recent.length === 0) {
    return <EmptyState mascot="driverWaiting" className="[&_span]:text-body-lg" title={t('driver.list.emptyTitle')} description={t('driver.list.emptyDescription')} />
  }
  return (
    <div className="flex flex-col gap-6">
      <Group title={t('driver.list.ready')}>
        {ready.length > 0
          // Một nút primary mỗi màn (mục 5): chuyến nên giao trước — đang giao dở, không thì chuyến đã xếp xong sớm nhất
          ? ready.map((row, index) => <MyTripCard key={row.id} row={row} primary={index === 0} />)
          : <li className="text-text-2">{t('driver.list.noReady')}</li>}
      </Group>
      {preparing.length > 0 ? (
        <Group title={t('driver.list.preparing')}>{preparing.map((row) => <MyTripCard key={row.id} row={row} />)}</Group>
      ) : null}
      {recent.length > 0 ? (
        <Group title={t('driver.list.recent')}>{recent.map((row) => <MyTripCard key={row.id} row={row} />)}</Group>
      ) : null}
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const id = useId()
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-h2 font-semibold">{title}</h2>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">{children}</ul>
    </section>
  )
}
