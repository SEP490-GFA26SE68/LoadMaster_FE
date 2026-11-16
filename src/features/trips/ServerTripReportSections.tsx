import type { ReactNode } from 'react'
import { ExceptionStatusChip } from '@/features/monitoring/monitoring-chips'
import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { VehicleName } from '@/components/VehicleName'
import { useFormat, useT } from '@/lib/i18n'
import type { ServerManualConfirm, ServerTripReport } from './server-trip-report-api'

/**
 * Các thẻ của báo cáo chuyến máy chủ, cùng bố cục với bản kho mẫu (`TripReportInfo`, `TripReportFlow`): thông tin chuyến, đối chiếu kiện,
 * sự cố cấp chuyến kèm tuyến đã đổi, xác nhận tay. Chỉ hiện điều máy chủ trả: không có khối lượng, giờ xe rời kho, số kiện xếp bằng QR
 * (máy chủ không tách quét với gõ mã) hay tên dòng kiện; tên người là tên máy chủ ghi kèm. Không MOCK RESULT, trừ tuyến thay thế (hệ số
 * cố định của máy chủ, như màn Giám sát).
 */

const card = 'flex-none overflow-hidden print:break-inside-avoid print:shadow-none'
const CONFIRM_TONE: Readonly<Record<ServerManualConfirm['status'], BadgeTone>> = { MANUAL_PENDING: 'warning', MANUAL_APPROVED: 'success', MANUAL_REJECTED: 'danger' }
const ROUTES = ['BYPASS', 'RING_ROAD', 'HIGHWAY'] as const

function useMoment() {
  const format = useFormat()
  return (iso: string) => `${format.time(iso)} · ${format.dayMonth(iso)}`
}

export function ServerTripReportInfo({ report }: { report: ServerTripReport }) {
  const t = useT()
  const format = useFormat()
  const { packages, loading } = report
  const moment = (value: string | null | undefined) => (value ? `${format.time(value)} · ${format.date(value)}` : t('tripReport.info.notYet'))
  const issues = report.stops.reduce((sum, stop) => sum + stop.issues, 0)
  return (
    <Card className="flex flex-col print:break-inside-avoid print:shadow-none">
      <CardHeader>
        <CardTitle as="h2">{t('tripReport.info.title')}</CardTitle>
      </CardHeader>
      {packages ? (
        <p className="m-0 border-b border-line-soft px-4.5 py-3 text-body font-medium text-ink-strong">
          {t('tripReport.summary', { delivered: packages.delivered, planned: packages.loaded, issues })}
        </p>
      ) : null}
      <dl className="m-0 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2.5 px-4.5 py-4 text-body">
        <Fact label={t('tripReport.info.name')}>{report.tripName}</Fact>
        <Fact label={t('tripReport.server.plannedDeparture')}>{moment(report.plannedDeparture)}</Fact>
        <Fact label={t('tripReport.info.vehicle')}>
          <VehicleName name={report.vehicle.name} /> <span className="font-mono text-caption text-ink-3">{report.vehicle.plate}</span>
        </Fact>
        <Fact label={t('tripReport.info.driver')}>{report.driverName ?? t('tripReport.info.noDriver')}</Fact>
        <Fact label={t('tripReport.info.seal')}>
          {loading?.seal
            ? <span className="font-mono">{loading.seal.at ? t('tripReport.info.sealValue', { number: loading.seal.number, time: format.time(loading.seal.at) }) : loading.seal.number}</span>
            : t('tripReport.info.noSeal')}
        </Fact>
        {report.overrideReason === null ? null : <Fact label={t('tripReport.info.override')}>{report.overrideReason}</Fact>}
        {packages ? (
          <>
            <Fact label={t('tripReport.server.total')} mono>{format.integer(packages.total)}</Fact>
            <Fact label={t('tripReport.info.staged')} mono>{format.integer(packages.staged)}</Fact>
            <Fact label={t('tripReport.server.loaded')} mono>{format.integer(packages.loaded)}</Fact>
            <Fact label={t('tripReport.info.damaged')} mono>{format.integer(packages.damaged)}</Fact>
            <Fact label={t('tripReport.info.returned')} mono>{format.integer(packages.returned)}</Fact>
          </>
        ) : null}
        <Fact label={t('tripReport.info.loadingStarted')}>{moment(loading?.startedAt)}</Fact>
        <Fact label={t('tripReport.info.loadingCompleted')}>{moment(loading?.completedAt)}</Fact>
        <Fact label={t('tripReport.info.deliveryCompleted')}>{moment(report.completedAt)}</Fact>
      </dl>
    </Card>
  )
}

function Fact({ label, mono = false, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <>
      <dt className="text-ink-3">{label}</dt>
      <dd className={mono ? 'm-0 font-mono text-ink-1 tabular-nums' : 'm-0 text-ink-1'}>{children}</dd>
    </>
  )
}

/**
 * Đối chiếu theo bước: quét QR, gõ mã và xác nhận tay; máy chủ cũ không tách hai cách đầu thì một cột "Bằng nhãn". Bước không có kiện nào
 * thì bỏ dòng.
 */
export function ServerTripReportVerifications({ report }: { report: ServerTripReport }) {
  const t = useT()
  const format = useFormat()
  const rows = report.verifications.filter((row) => row.label + row.manual > 0)
  const split = report.verifications.length > 0 && report.verifications.every((row) => row.qr !== null && row.code !== null)
  const cell = 'px-4.5 text-right font-mono text-ink-1 tabular-nums'
  return (
    <Card className={card}>
      <CardHeader>
        <CardTitle as="h2">{t('tripReport.verify.title')}</CardTitle>
      </CardHeader>
      <table className="w-full border-collapse text-body">
        <thead>
          <tr className="h-10 bg-table-head text-caption font-semibold text-ink-2">
            <th scope="col" className="px-4.5 text-left font-semibold">{t('tripReport.verify.step')}</th>
            {split ? (
              <>
                <th scope="col" className="px-4.5 text-right font-semibold">{t('common.verifyMethods.QR')}</th>
                <th scope="col" className="px-4.5 text-right font-semibold">{t('common.verifyMethods.CODE')}</th>
              </>
            ) : (
              <th scope="col" className="px-4.5 text-right font-semibold">{t('tripReport.server.byLabel')}</th>
            )}
            <th scope="col" className="px-4.5 text-right font-semibold">{t('common.verifyMethods.MANUAL')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.step} className="h-10 border-t border-line-soft">
              <th scope="row" className="px-4.5 text-left font-medium text-ink-1">{t(`common.verifyContexts.${row.step}`)}</th>
              {split ? (
                <>
                  <td className={cell}>{format.integer(row.qr ?? 0)}</td>
                  <td className={cell}>{format.integer(row.code ?? 0)}</td>
                </>
              ) : (
                <td className={cell}>{format.integer(row.label)}</td>
              )}
              <td className={cell}>{format.integer(row.manual)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 border-t border-line-soft px-4.5 py-2.5 text-note text-ink-3">{t(split ? 'tripReport.server.verifyMethodsNote' : 'tripReport.server.verifyNote')}</p>
    </Card>
  )
}

export function ServerTripReportManualConfirms({ report }: { report: ServerTripReport }) {
  const t = useT()
  const format = useFormat()
  const moment = useMoment()
  const nameOf = (name: string) => name || t('tripReport.manual.unknownUser')
  return (
    <Card className={card}>
      <CardHeader>
        <CardTitle as="h2">{t('tripReport.manual.title')}</CardTitle>
        <CardMeta>{format.integer(report.manualConfirms.length)}</CardMeta>
      </CardHeader>
      {report.manualConfirms.length === 0 ? (
        <p className="m-0 px-4.5 py-4 text-body text-ink-3">{t('tripReport.manual.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {report.manualConfirms.map((confirm) => {
            const step = confirm.step === null ? '' : t(`common.verifyContexts.${confirm.step}`)
            const reasonCode = confirm.reason === null ? '' : t(`common.manualConfirmReasons.${confirm.reason}`)
            const reason = confirm.note ? (reasonCode ? `${reasonCode} — ${confirm.note}` : confirm.note) : reasonCode
            return (
              <li key={confirm.id} className="flex flex-col gap-1 border-t border-line-soft px-4.5 py-3 text-small text-ink-2">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="font-mono font-semibold text-ink-strong">{confirm.packageCode}</span>
                  <Badge shape="tag" tone={CONFIRM_TONE[confirm.status]}>{t(`tripReport.manual.statuses.${confirm.status}`)}</Badge>
                </div>
                {step ? <span>{confirm.stopNumber === null ? step : t('tripReport.manual.step', { context: step, number: format.integer(confirm.stopNumber) })}</span> : null}
                {confirm.requestedAt ? <span>{t('tripReport.manual.requested', { time: moment(confirm.requestedAt), name: nameOf(confirm.requestedBy), reason })}</span> : null}
                {confirm.decidedAt === null ? null : confirm.status === 'MANUAL_REJECTED' ? (
                  <span>{t('tripReport.manual.rejected', { time: moment(confirm.decidedAt), name: nameOf(confirm.decidedBy), reason: confirm.decisionNote })}</span>
                ) : (
                  <span>{t('tripReport.manual.decided', { time: moment(confirm.decidedAt), name: nameOf(confirm.decidedBy) })}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

export function ServerTripReportIncidents({ report }: { report: ServerTripReport }) {
  const t = useT()
  const format = useFormat()
  const moment = useMoment()
  const nameOf = (name: string) => name || t('monitoring.exceptions.unknownUser')
  return (
    <Card className={card}>
      <CardHeader>
        <CardTitle as="h2">{t('tripReport.incidents.title')}</CardTitle>
        <CardMeta>{format.integer(report.exceptions.length)}</CardMeta>
      </CardHeader>
      {report.exceptions.length === 0 ? (
        <p className="m-0 px-4.5 py-4 text-body text-ink-3">{t('tripReport.incidents.none')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0">
          {report.exceptions.map((exception) => (
            <li key={exception.id} className="flex flex-col gap-1.5 border-t border-line-soft px-4.5 py-3">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <span className="font-semibold text-ink-strong">{t(`common.tripExceptionTypes.${exception.type}`)}</span>
                <ExceptionStatusChip status={exception.status} />
              </div>
              {exception.description ? <p className="m-0 text-body text-ink-1">{exception.description}</p> : null}
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-small text-ink-2">
                <li>
                  {exception.reportedAt ? <>{t('monitoring.exceptions.reported', { time: moment(exception.reportedAt), name: nameOf(exception.reportedBy) })}{' · '}</> : null}
                  {t('monitoring.exceptions.delay', { count: exception.delayMinutes })}
                </li>
                {exception.resolvedAt ? <li>{t('monitoring.exceptions.resolved', { time: moment(exception.resolvedAt), name: nameOf(exception.resolvedBy) })}</li> : null}
                {exception.resolutionNote ? <li>{exception.resolutionNote}</li> : null}
              </ul>
            </li>
          ))}
        </ul>
      )}
      {report.reroutes.length > 0 ? (
        <section aria-label={t('tripReport.incidents.reroutes')} className="flex flex-col gap-1.5 border-t border-line-soft px-4.5 py-3">
          <h3 className="m-0 flex items-center gap-2 text-small font-semibold text-ink-2">
            {t('tripReport.incidents.reroutes')}
            <Badge shape="tag" tone="mock">MOCK RESULT</Badge>
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-small text-ink-2">
            {report.reroutes.map((reroute) => {
              const known = ROUTES.find((route) => route === reroute.route)
              return (
                <li key={reroute.confirmedAt}>
                  {t('monitoring.reroute.current', {
                    time: moment(reroute.confirmedAt), route: known ? t(`monitoring.reroute.routes.${known}`) : reroute.route,
                    km: format.decimal(reroute.distanceKm), minutes: format.integer(reroute.durationMinutes), number: format.integer(reroute.stopNumber),
                  })}
                </li>
              )
            })}
          </ul>
        </section>
      ) : null}
    </Card>
  )
}
