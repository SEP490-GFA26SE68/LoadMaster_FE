import { Link } from 'react-router'
import { Lumo } from '@/components/brand/Lumo'
import { LanguageSwitch } from '@/components/LanguageSwitch'
import { Button } from '@/components/ui/Button'
import { ExitIconButton } from '@/features/auth/ExitControl'
import { useFormat, useT } from '@/lib/i18n'
import type { Revision, Trip } from '@/lib/mock-db'
import { loadingProgress } from './loading-session'
import { SealCard } from './SealCard'
import { useSessionModel } from './useSessionModel'
import { loadingSessionPath } from './warehouse-trips'

/**
 * Màn "Xếp xong — chờ xuất phát" (LM-086, FE-6-05): số kiện đã xếp trên tổng, danh sách kiện hỏng bị bỏ lại kho, nút về danh sách chuyến. Mọi số đọc từ tiến độ
 * trong kho (D-47). Mở lại chuyến đã xếp xong (kể cả khi xe đã đi giao) cũng ra màn này. Review 1 (LM-104): số kiện xác nhận bằng quét
 * QR và ô niêm phong thùng (số seal, không bắt buộc).
 */
export function LoadingFinished({ trip, plan }: { trip: Trip; plan: Revision }) {
  const t = useT()
  const format = useFormat()
  const model = useSessionModel(trip, plan)
  const progress = loadingProgress(model.placements, trip.loading)
  const loadedByQr = trip.loading?.steps.filter((step) => step.outcome === 'loaded' && step.via === 'qr').length ?? 0

  return (
    <div className="flex h-dvh flex-col bg-bg text-body-lg">
      <header className="flex h-18 flex-none items-center gap-4 border-b border-border pr-6 pl-3">
        <ExitIconButton screenHome={loadingSessionPath(trip.id)} contextual={`/chuyen/${trip.id}`} label={t('warehouse.header.exit')} iconClassName="size-7" />
        <span className="min-w-0 flex-1 truncate font-mono text-[18px] leading-6 font-semibold">{trip.id}</span>
        <LanguageSwitch size="touch" className="flex-none" />
      </header>
      <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex max-w-200 flex-col items-start gap-4">
          {/* Lumo giơ ngón cái: xong việc lớn (LM-105) */}
          <Lumo pose="done" size="lg" />
          <h1 className="text-h1 font-semibold">
            {t('warehouse.finished.title', { tripId: trip.id })}
          </h1>
          <p className="m-0 text-h2 font-medium">
            {t('warehouse.finished.loaded', { loaded: format.integer(progress.loaded), total: format.integer(progress.total) })}
          </p>
          {trip.phase === 'loaded' ? <p className="m-0 text-text-2">{t('warehouse.finished.description')}</p> : null}
          {progress.damaged.length > 0 ? (
            <section aria-labelledby="kien-hong" className="flex w-full flex-col gap-2">
              <h2 id="kien-hong" className="text-h2 font-semibold">{t('warehouse.finished.damagedTitle', { count: progress.damaged.length })}</h2>
              <ul className="m-0 flex list-none flex-col overflow-hidden rounded-md border border-border p-0">
                {progress.damaged.map((placement) => (
                  <li key={placement.id} className="flex flex-wrap items-baseline gap-x-3 border-b border-border px-4 py-3 last:border-b-0">
                    <span className="font-mono font-semibold">{placement.id}</span>
                    <span className="text-text-2">{placement.name} · {t('common.stop', { number: placement.stop })}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="m-0 text-text-2">{t('warehouse.finished.noDamaged')}</p>
          )}
          {loadedByQr > 0 ? <p className="m-0 text-text-2">{t('warehouse.scan.recordedByQr', { count: loadedByQr })}</p> : null}
          <SealCard trip={trip} />
          {/* Chưa ghi seal khi xe còn ở kho: nút ghi seal là nút chính, lối về danh sách là nút phụ (một nút chính mỗi màn) */}
          <Button asChild variant={trip.phase === 'loaded' && !trip.loading?.seal ? 'secondary' : 'primary'} size="touch">
            <Link to="/kho">{t('warehouse.backToList')}</Link>
          </Button>
        </div>
      </main>
    </div>
  )
}
