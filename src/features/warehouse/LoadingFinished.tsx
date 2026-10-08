import { Link } from 'react-router'
import { Lumo } from '@/components/brand/Lumo'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { TouchTopBar } from '@/components/TouchTopBar'
import { VehicleName } from '@/components/VehicleName'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { calendarDate } from '@/lib/calendar-date'
import { useFormat, useT } from '@/lib/i18n'
import type { Revision, Trip } from '@/lib/mock-db'
import { loadingProgress, stopTallies } from './loading-session'
import { SealCard } from './SealCard'
import { StopDot } from './StopChip'
import { useSessionModel } from './useSessionModel'
import { useWarehouseTripsQuery } from './useWarehouseQueries'
import { loadingSessionPath } from './warehouse-trips'

/**
 * Màn "Xếp xong — chờ xuất phát" (LM-086, FE-6-05; V2.3 đợt 6, `KhoXepXong.jpg`): Lumo nhỏ và tiêu đề, hai ô số (đã xếp trên tổng, bỏ lại
 * kho), danh sách kiện hỏng bỏ lại kho, bảng "Theo điểm giao", thông tin chuyến, ô niêm phong và nút về danh sách chuyến. Mọi số đọc từ
 * phương án và tiến độ trong kho (D-47) — không số nào nghĩ ra; tên tài xế không có ở màn này nên không hiện. Mở lại chuyến đã xếp xong
 * (kể cả khi xe đã đi giao) cũng ra màn này. Review 1 (LM-104): số kiện xác nhận bằng quét QR và ô niêm phong thùng (số seal, không bắt buộc).
 */
export function LoadingFinished({ trip, plan }: { trip: Trip; plan: Revision }) {
  const t = useT()
  const format = useFormat()
  const model = useSessionModel(trip, plan)
  const progress = loadingProgress(model.placements, trip.loading)
  const loadedByQr = trip.loading?.steps.filter((step) => step.outcome === 'loaded' && step.via === 'qr').length ?? 0
  const tallies = stopTallies(model.stops, model.placements, progress.damaged)
  // Tên xe từ danh sách chuyến của kho (cùng khoá truy vấn); chuyến xe đã đi giao không còn trong danh sách nên không hiện dòng xe
  const vehicleName = useWarehouseTripsQuery().data?.find((row) => row.id === trip.id)?.vehicleName

  return (
    <div className="flex h-dvh flex-col bg-app text-body-lg">
      <TouchTopBar
        leading={<ExitIconButton tone="sky" screenHome={loadingSessionPath(trip.id)} contextual={`/chuyen/${trip.id}`} label={t('warehouse.header.exit')} iconClassName="size-7" />}
        trailing={<LanguageSwitch size="touch" tone="sky" className="flex-none" />}
      >
        <span className="min-w-0 flex-1 truncate font-mono text-[18px] leading-6 font-semibold text-sky-text">{trip.id}</span>
      </TouchTopBar>
      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <Card className="mx-auto grid w-full max-w-250 gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="flex min-w-0 flex-col gap-5">
            <div className="flex items-center gap-4">
              {/* Lumo giơ ngón cái: xong việc lớn (LM-105), thu nhỏ để nhường chỗ cho số liệu */}
              <Lumo pose="done" size="sm" />
              <div className="flex min-w-0 flex-col gap-1">
                <h1 className="font-display text-h1 leading-8 font-bold text-ink-strong font-stretch-112%">
                  {t('warehouse.finished.title', { tripId: trip.id })}
                </h1>
                {trip.phase === 'loaded' ? <p className="m-0 text-pretty text-ink-2">{t('warehouse.finished.description')}</p> : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div
                role="group"
                aria-label={t('warehouse.finished.loaded', { loaded: format.integer(progress.loaded), total: format.integer(progress.total) })}
                className="flex flex-col gap-1 rounded-lg border border-line-soft bg-surface p-4"
              >
                <span className="text-ink-3">{t('warehouse.finished.tiles.loaded')}</span>
                <span className="text-ink-3">
                  <span className="font-display text-[32px] leading-10 font-bold text-ink-strong tabular-nums">{format.integer(progress.loaded)}</span>{' '}
                  {t('warehouse.finished.tiles.ofTotal', { total: format.integer(progress.total) })}
                </span>
              </div>
              <div
                className={
                  progress.damaged.length > 0
                    ? 'flex flex-col gap-1 rounded-lg border border-badge-warning-border bg-badge-warning-bg p-4 text-badge-warning-fg'
                    : 'flex flex-col gap-1 rounded-lg border border-line-soft bg-surface p-4 text-ink-3'
                }
              >
                <span>{t('warehouse.finished.tiles.left')}</span>
                <span>
                  <span className="font-display text-[32px] leading-10 font-bold tabular-nums">{format.integer(progress.damaged.length)}</span>{' '}
                  {t('warehouse.finished.tiles.unit')}
                </span>
              </div>
            </div>

            {progress.damaged.length > 0 ? (
              <section aria-labelledby="kien-hong" className="flex w-full flex-col gap-2">
                <h2 id="kien-hong" className="font-display text-h3 font-[650] text-ink-strong font-stretch-106%">{t('warehouse.finished.damagedTitle', { count: progress.damaged.length })}</h2>
                <ul className="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-badge-warning-border bg-badge-warning-bg p-0">
                  {progress.damaged.map((placement) => (
                    <li key={placement.id} className="flex flex-wrap items-baseline gap-x-3 border-b border-badge-warning-border px-4 py-3 last:border-b-0">
                      <span className="font-mono font-semibold text-ink-strong">{placement.id}</span>
                      <span className="text-ink-2">{placement.name} · {t('common.stop', { number: placement.stop })}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : (
              <p className="m-0 text-ink-2">{t('warehouse.finished.noDamaged')}</p>
            )}

            {tallies.length > 0 ? (
              <section aria-labelledby="theo-diem-giao" className="flex w-full flex-col gap-2">
                <h2 id="theo-diem-giao" className="font-display text-h3 font-[650] text-ink-strong font-stretch-106%">{t('warehouse.finished.byStop.title')}</h2>
                <ul className="m-0 flex list-none flex-col overflow-hidden rounded-lg border border-line-soft p-0">
                  {tallies.map((tally) => (
                    <li key={tally.stop} className="flex items-center gap-3 border-b border-line-soft px-4 py-3 last:border-b-0">
                      <StopDot stop={tally.stop} />
                      <span className="sr-only">{t('common.stop', { number: tally.stop })}</span>
                      <span className="min-w-0 flex-1 text-pretty text-ink-strong">{tally.name}</span>
                      <span className="flex-none font-display font-bold text-ink-strong tabular-nums">
                        {format.integer(tally.total - tally.left)} <span className="font-normal text-ink-3">/ {format.integer(tally.total)}</span>
                      </span>
                      {tally.left > 0 ? <span className="flex-none font-semibold text-badge-warning-fg">{t('warehouse.finished.byStop.left', { count: tally.left })}</span> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {loadedByQr > 0 ? <p className="m-0 text-ink-2">{t('warehouse.scan.recordedByQr', { count: loadedByQr })}</p> : null}
          </div>

          <div className="flex min-w-0 flex-col gap-5 lg:border-l lg:border-line-soft lg:pl-6">
            <dl className="m-0 flex flex-col gap-3">
              <Info label={t('warehouse.header.trip')}>{trip.name}</Info>
              {vehicleName ? <Info label={t('warehouse.list.vehicle')}><VehicleName name={vehicleName} /></Info> : null}
              <Info label={t('warehouse.list.date')}>{format.date(calendarDate(trip.scheduledDate))}</Info>
            </dl>
            <SealCard trip={trip} />
            {/* Chưa ghi seal khi xe còn ở kho: nút ghi seal là nút chính, lối về danh sách là nút phụ (một nút chính mỗi màn) */}
            <Button asChild variant={trip.phase === 'loaded' && !trip.loading?.seal ? 'secondary' : 'primary'} size="touch" className="w-full">
              <Link to="/kho">{t('warehouse.backToList')}</Link>
            </Button>
          </div>
        </Card>
      </main>
    </div>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-ink-3">{label}</dt>
      <dd className="m-0 font-semibold text-pretty text-ink-strong">{children}</dd>
    </div>
  )
}
