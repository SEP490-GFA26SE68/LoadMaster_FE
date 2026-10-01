import { ArrowRight, Clock, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { useMemo } from 'react'
import { staleReason, type StaleEdit } from '@/features/trips/trip-detail'
import { useTripActivityQuery } from '@/features/trips/useTripsQuery'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { isStale, type Trip } from '@/lib/mock-db'
import type { User } from '@/types/user'
import type { PlannerLock } from './approval/planner-access'
import { approvedElsewhere, planTripDelta, warehouseProgress } from './plan-notices'
import { PlannerLockNotice } from './PlannerLockNotice'
import { PlannerNoticeBar, PlannerNoticeLink } from './PlannerNoticeBar'
import type { ViewerSceneModel } from './scene-input'
import type { PlanSource } from './viewer-api'

/**
 * Các thanh thông báo dưới thanh trên Planner (V2.3, LM-107), trên nền tối, xếp dọc: lý do khoá (kèm tiến độ kho, `Planner3DKhoa`),
 * phương án lỗi thời (lần sửa làm lỗi thời, số kiện phương án ↔ chuyến, chênh theo điểm giao, `Planner3DLoiThoi`) và đang xem một bản
 * chưa duyệt trong khi kho đọc bản đã duyệt (`Planner3DBanChuaDuyet`). Mọi số lấy từ kho qua nhật ký chuyến; fixture benchmark
 * (không có `source`) chỉ có thanh khoá.
 */
export function PlannerNotices({ model, source, lock, rerunTo }: {
  model: ViewerSceneModel
  source?: PlanSource
  lock: PlannerLock | null
  /** Lối tới Thiết lập tối ưu khi người xem chạy lại được và chuyến còn lập kế hoạch (LM-104). */
  rerunTo?: string
}) {
  const t = useT()
  const format = useFormat()
  const activity = useTripActivityQuery(source ? source.trip.id : '').data
  const nameOf = (id: string | null) => (id ? activity?.users.find((user) => user.id === id)?.fullName ?? null : null)
  const viewedId = model.revision?.id ?? null

  const progress = source && activity && (lock === 'loading' || lock === 'loaded') ? warehouseProgress(source.trip, activity.revisions) : null
  const progressLine = progress ? t(progress.startedBy && nameOf(progress.startedBy) ? 'viewer.lock.progressBy' : 'viewer.lock.progress', {
    loaded: format.integer(progress.loaded), total: format.integer(progress.total),
    time: format.time(progress.startedAt), date: format.dayMonth(progress.startedAt), name: nameOf(progress.startedBy) ?? '',
  }) : undefined

  const approved = source && activity && viewedId ? approvedElsewhere(viewedId, activity.revisions) : null

  return (
    <div className="flex flex-none flex-col items-start gap-2 px-2 pt-2 empty:hidden xl:px-3.5 xl:pt-2.5">
      <PlannerLockNotice lock={lock} detail={progressLine} />
      {model.revision?.stale ? <StaleNotice source={source} users={activity?.users ?? []}
        edit={source && activity ? staleEditOf(source.trip, activity, viewedId) : null} rerunTo={rerunTo} /> : null}
      {source && approved && viewedId ? (
        <PlannerNoticeBar role="status" data-planner-unapproved tone="info" icon={Clock}
          title={t('viewer.plan.viewing', { revision: viewedId, time: format.time(source.revision.createdAt), date: format.dayMonth(source.revision.createdAt) })}
          detail={t(isStale(approved, source.trip) ? 'viewer.plan.viewingApprovedStale' : 'viewer.plan.viewingApproved', {
            revision: approved.id, time: format.time(approved.approvedAt ?? approved.createdAt), date: format.dayMonth(approved.approvedAt ?? approved.createdAt),
          })}
          action={<PlannerNoticeLink tone="info" to={`/chuyen/${source.trip.id}/phuong-an?revision=${approved.id}`} icon={ArrowRight}>
            {t('viewer.plan.openApproved', { revision: approved.id })}
          </PlannerNoticeLink>} />
      ) : null}
    </div>
  )
}

/** Lần sửa làm lỗi thời chỉ kể được cho bản duyệt mới nhất (nhật ký tính từ lúc duyệt bản đó); bản khác chỉ có số kiện. */
function staleEditOf(trip: Trip, activity: NonNullable<ReturnType<typeof useTripActivityQuery>['data']>, viewedId: string | null): StaleEdit | null {
  const reason = staleReason(trip, activity.revisions, activity.events)
  return reason && reason.revisionId === viewedId ? reason.edit : null
}

function StaleNotice({ source, edit, users, rerunTo }: {
  source?: PlanSource
  edit: StaleEdit | null
  users: readonly User[]
  rerunTo?: string
}) {
  const t = useT()
  const format = useFormat()
  const delta = useMemo(() => (source ? planTripDelta(source.revision.request.packages, source.trip.packages) : null), [source])
  const sentences: string[] = []
  if (source && edit) sentences.push(`${t('viewer.plan.staleSince', { time: format.time(source.revision.createdAt), date: format.dayMonth(source.revision.createdAt) })} ${editText(edit, source.trip, users, t, format)}`)
  if (delta && delta.plan !== delta.trip) sentences.push(t('viewer.plan.staleCounts', { plan: format.integer(delta.plan), trip: format.integer(delta.trip) }))
  if (delta && delta.stops.length > 0) {
    const list = format.list(delta.stops.map((stop) => t('viewer.plan.staleStop', { number: stop.number, delta: signed(stop.trip - stop.plan, format.integer) })))
    sentences.push(t('viewer.plan.staleStops', { list }))
  }
  if (source) sentences.push(t('viewer.plan.staleApprove'))
  return (
    <PlannerNoticeBar role="alert" data-planner-stale tone="warning" icon={TriangleAlert} title={t('viewer.plan.staleBanner')}
      detail={sentences.length > 0 ? sentences.join(' ') : undefined}
      action={rerunTo ? <PlannerNoticeLink tone="warning" to={rerunTo} icon={SlidersHorizontal}>{t('viewer.plan.rerun')}</PlannerNoticeLink> : null} />
  )
}

type Format = ReturnType<typeof useFormat>

function signed(value: number, integer: (value: number) => string): string {
  return value > 0 ? `+${integer(value)}` : integer(value)
}

/** "PKG-001 Kiện nước giặt 4 can · Số lượng 80 → 86 (11:40 · 24/09 · Nguyễn Thanh Tùng)" hoặc "đã sửa Xe (…)". */
function editText(edit: StaleEdit, trip: Pick<Trip, 'packages'>, users: readonly User[], t: TFunction, format: Format): string {
  const actor = edit.actorId ? users.find((user) => user.id === edit.actorId)?.fullName ?? null : null
  const when = actor
    ? t('viewer.plan.staleWhenBy', { time: format.time(edit.at), date: format.dayMonth(edit.at), name: actor })
    : t('viewer.plan.staleWhen', { time: format.time(edit.at), date: format.dayMonth(edit.at) })
  const value = (raw: string | number) => (typeof raw === 'number' ? format.integer(raw) : raw)
  if (edit.packageId) {
    const name = trip.packages.find((item) => item.id === edit.packageId)?.name
    const change = edit.field && edit.before !== undefined && edit.after !== undefined
      ? ` · ${t('viewer.plan.staleChange', { field: t(`audit.log.packageFields.${edit.field}`), before: value(edit.before), after: value(edit.after) })}`
      : ''
    return `${edit.packageId}${name ? ` ${name}` : ''}${change} ${when}`
  }
  const fields = edit.fields.filter((field): field is 'vehicleId' | 'packages' => field === 'vehicleId' || field === 'packages').map((field) => t(`audit.log.fieldNames.${field}`))
  return `${t('viewer.plan.staleFields', { fields: format.list(fields) })} ${when}`
}
