import { CircleAlert, PackageMinus, PackageX, Undo2, type LucideIcon } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { StopLabel } from '@/components/StopLabel'
import { expandPackages } from '@/domain/cargo'
import type { DeliveryIssueKind, Trip } from '@/lib/mock-db'
import { useFormat, useT } from '@/lib/i18n'
import { stopColor, stopForeground } from '@/lib/stops'
import { damagedPackages } from './trip-progress'
import { useTripActivityQuery } from './useTripsQuery'

const KIND_ICON: Record<DeliveryIssueKind, LucideIcon> = { damaged: PackageX, missing: PackageMinus, refused: Undo2, other: CircleAlert }

/**
 * Mục sự cố ở cột phải Chi tiết chuyến (D-47; V2.3 `ChiTietChuyenHoanThanh.jpg`): kiện kho báo thiếu và sự cố giao hàng — loại, điểm
 * giao, kiện, ghi chú, giờ và người báo — mỗi mục một ô hổ phách. Không có gì thì không hiện. Mọi dòng lấy từ tiến độ của kho.
 */
export function TripDetailIssues({ trip }: { trip: Trip }) {
  const t = useT()
  const format = useFormat()
  const activity = useTripActivityQuery(trip.id)
  const users = activity.data?.users
  const damaged = useMemo(() => damagedPackages(trip), [trip])
  const nameOfPackage = useMemo(() => {
    const { packageIdByInstanceId } = expandPackages(trip.packages)
    const names = new Map(trip.packages.map((pkg) => [pkg.id, pkg.name]))
    return (instanceId: string) => names.get(packageIdByInstanceId.get(instanceId) ?? '')
  }, [trip.packages])
  const nameOf = (id: string | null) => (id ? users?.find((user) => user.id === id)?.fullName ?? id : null)
  const issues = trip.delivery?.issues ?? []
  if (damaged.length === 0 && issues.length === 0) return null

  return (
    <>
      {damaged.length > 0 ? (
        <Section title={t('trips.detail.damagedTitle', { count: damaged.length })}>
          {damaged.map((item) => (
            <Item key={item.packageInstanceId} icon={PackageMinus} title={<span className="font-mono text-caption">{item.packageInstanceId}</span>} stop={item.deliveryStop}>
              <span className="text-ink-2">{item.name}</span>
              <span className="text-fine text-ink-3 tabular-nums">{t('trips.detail.at', { time: format.time(item.at), date: format.date(item.at) })}</span>
            </Item>
          ))}
        </Section>
      ) : null}
      {issues.length > 0 ? (
        <Section title={t('trips.detail.issuesTitle', { count: issues.length })}>
          {issues.map((issue) => {
            const reporter = nameOf(issue.reportedBy)
            const pkgName = issue.packageInstanceId ? nameOfPackage(issue.packageInstanceId) : undefined
            return (
              <Item key={issue.id} icon={KIND_ICON[issue.kind]} title={t(`common.deliveryIssueKinds.${issue.kind}`)} stop={issue.stopNumber}>
                <span className="text-ink-2">
                  <span className="font-mono text-caption font-semibold text-ink-strong">{issue.packageInstanceId ?? t('trips.detail.wholeStop')}</span>
                  {pkgName ? ` · ${pkgName}` : null}
                </span>
                {issue.note ? <span className="text-ink-strong">{issue.note}</span> : null}
                <span className="text-fine text-ink-3 tabular-nums">
                  {t('trips.detail.at', { time: format.time(issue.at), date: format.date(issue.at) })}
                  {reporter ? ` · ${reporter}` : null}
                </span>
              </Item>
            )
          })}
        </Section>
      ) : null}
    </>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5 border-b border-line-soft px-4.5 py-4">
      <h3 className="font-display text-body-lg leading-5 font-[650] text-ink-strong font-stretch-106%">{title}</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">{children}</ul>
    </section>
  )
}

function Item({ icon: Icon, title, stop, children }: { icon: LucideIcon; title: ReactNode; stop: number; children: ReactNode }) {
  return (
    <li className="flex flex-col gap-0.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-small">
      <span className="flex items-center gap-2 text-body">
        <Icon aria-hidden className="size-4 flex-none text-amber-700" strokeWidth={1.75} />
        <b className="font-semibold text-ink-strong">{title}</b>
        <span aria-hidden className="text-ink-3">·</span>
        <span
          aria-hidden
          className="grid size-5 flex-none place-items-center rounded-sm font-mono text-note font-semibold"
          style={{ background: stopColor(stop), color: stopForeground(stop) }}
        >
          {stop}
        </span>
        <span className="text-ink-2"><StopLabel number={stop} /></span>
      </span>
      {children}
    </li>
  )
}
