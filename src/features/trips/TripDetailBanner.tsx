import { ArrowRight, Lock, Pencil } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { Banner } from '@/components/Banner'
import { useCan } from '@/features/auth/useCan'
import type { Trip } from '@/lib/mock-db'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { staleReason, type StaleEdit } from './trip-detail'
import { useTripActivityQuery } from './useTripsQuery'

const actionLink = 'inline-flex items-center gap-1.5 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary [&_svg]:size-4'

/**
 * Banner theo pha trên dải trời của Chi tiết chuyến (V2.3): bản duyệt lỗi thời nói **vì sao** — lần sửa xe/kiện mới nhất kèm trước
 * → sau, giờ và người sửa, lấy từ nhật ký (quyết định 2) — và dẫn tới Thiết lập tối ưu; kho đang xếp / đã xếp xong nói lý do khoá và
 * phần vẫn sửa được; chuyến đã huỷ nói lúc huỷ và lý do. Pha khác không có banner (đang giao, hoàn thành: một dòng dưới nút ở header).
 */
export function TripDetailBanner({ trip }: { trip: Trip }) {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const activity = useTripActivityQuery(trip.id)
  const data = activity.data
  const stale = useMemo(() => (data ? staleReason(trip, data.revisions, data.events) : null), [trip, data])
  const nameOf = (id: string | null) => (id ? data?.users.find((user) => user.id === id)?.fullName ?? id : null)

  if (stale) {
    return (
      <Banner
        tone="warning"
        action={can('optimization.run') ? (
          <Link to={`/chuyen/${trip.id}/toi-uu`} className={actionLink}>
            {t('trips.detail.stale.action')}
            <ArrowRight strokeWidth={1.75} aria-hidden />
          </Link>
        ) : null}
      >
        <b className="font-semibold">{t('trips.detail.stale.title', { revision: stale.revisionId })}</b> {t('trips.detail.stale.body')}
        {stale.edit ? <StaleEditLine edit={stale.edit} trip={trip} actor={nameOf(stale.edit.actorId)} /> : null}
      </Banner>
    )
  }

  if (trip.phase === 'loading' || trip.phase === 'loaded') {
    return (
      <Banner
        tone="info"
        icon={Lock}
        action={can('trips.edit') ? (
          <Link to={`/chuyen/${trip.id}/sua`} className={actionLink}>
            <Pencil strokeWidth={1.75} aria-hidden />
            {t('trips.detail.edit')}
          </Link>
        ) : null}
      >
        <b className="font-semibold">{t(`trips.detail.locked.${trip.phase}`)}</b> {t('trips.detail.stillEditable')}
      </Banner>
    )
  }

  if (trip.phase === 'cancelled') {
    const { cancellation } = trip
    return (
      <Banner
        tone="danger"
        action={<span className="rounded-sm border border-red-200 bg-bg px-2 py-0.5 text-caption">{t('trips.detail.readOnly')}</span>}
      >
        {cancellation
          ? t('trips.detail.locked.cancelled', { time: format.time(cancellation.at), date: format.date(cancellation.at), reason: cancellation.reason })
          : t('trips.detail.locked.completed')}
      </Banner>
    )
  }
  return null
}

/** Dòng thứ hai của banner lỗi thời: "Sửa lúc 11:40 24/09/2026 · Người sửa — PKG-001 Tên kiện · Số lượng 80 → 86". */
function StaleEditLine({ edit, trip, actor }: { edit: StaleEdit; trip: Pick<Trip, 'packages'>; actor: string | null }) {
  const t = useT()
  const format = useFormat()
  const pkg = edit.packageId ? trip.packages.find((item) => item.id === edit.packageId) : undefined
  const value = (raw: string | number) => (typeof raw === 'number' ? format.integer(raw) : raw)
  return (
    <p className="mt-1 text-small">
      <span className="tabular-nums">{t('trips.detail.stale.editedAt', { time: format.time(edit.at), date: format.date(edit.at) })}</span>
      {actor ? ` · ${actor}` : null}
      {' — '}
      {edit.packageId ? (
        <>
          <span className="font-mono text-caption">{edit.packageId}</span>
          {pkg ? ` ${pkg.name}` : null}
          {edit.field && edit.before !== undefined && edit.after !== undefined ? (
            <>
              {` · ${t(`audit.log.packageFields.${edit.field}`)} `}
              <span className="inline-flex items-center gap-1.5 rounded-sm bg-bg px-2 align-middle ring-1 ring-amber-200 ring-inset">
                <span aria-hidden className="text-ink-3 line-through tabular-nums">{value(edit.before)}</span>
                <ArrowRight aria-hidden className="size-3 text-amber-700" strokeWidth={2} />
                <b aria-hidden className="font-semibold tabular-nums">{value(edit.after)}</b>
                <span className="sr-only">{t('trips.detail.stale.change', { before: value(edit.before), after: value(edit.after) })}</span>
              </span>
            </>
          ) : null}
        </>
      ) : (
        t('trips.detail.stale.fields', { fields: format.list(edit.fields.map((field) => fieldLabel(field, t))) })
      )}
    </p>
  )
}

function fieldLabel(field: string, t: TFunction): string {
  return field === 'vehicleId' || field === 'packages' ? t(`audit.log.fieldNames.${field}`) : field
}
