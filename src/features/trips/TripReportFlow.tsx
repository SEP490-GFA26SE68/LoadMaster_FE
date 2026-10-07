import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { ExceptionStatusChip } from '@/features/monitoring/monitoring-chips'
import { ExceptionFacts } from '@/features/monitoring/TripExceptionList'
import { useFormat, useT } from '@/lib/i18n'
import { VERIFY_CONTEXTS, VERIFY_METHODS, type ManualConfirmStatus, type TripReport } from '@/lib/mock-db'

/**
 * Phần của báo cáo chuyến cho luồng mới (FE-6-14): cách đối chiếu kiện ở từng bước, xác nhận tay kèm người duyệt, sự cố cấp chuyến và
 * tuyến đã đổi. Chỉ đọc — mọi dòng là điều kho đã ghi. Chữ người nhập (ghi chú, mô tả) xuống dòng tự do, không cắt, để bản in đủ chữ.
 */

type Names = Readonly<Record<string, string>>

const card = 'flex-none overflow-hidden print:break-inside-avoid print:shadow-none'
const CONFIRM_TONE: Readonly<Record<ManualConfirmStatus, BadgeTone>> = { MANUAL_PENDING: 'warning', MANUAL_APPROVED: 'success', MANUAL_REJECTED: 'danger' }

/** Số kiện theo cách đối chiếu (quét, gõ mã, xác nhận tay) ở ba bước soạn, xếp, dỡ. */
export function TripReportVerifications({ report }: { report: TripReport }) {
  const t = useT()
  const format = useFormat()
  return (
    <Card className={card}>
      <CardHeader>
        <CardTitle as="h2">{t('tripReport.verify.title')}</CardTitle>
      </CardHeader>
      <table className="w-full border-collapse text-body">
        <thead>
          <tr className="h-10 bg-table-head text-caption font-semibold text-ink-2">
            <th scope="col" className="px-4.5 text-left font-semibold">{t('tripReport.verify.step')}</th>
            {VERIFY_METHODS.map((method) => (
              <th key={method} scope="col" className="px-4.5 text-right font-semibold">{t(`common.verifyMethods.${method}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Bước nhận dọc đường (FE-7-05) chỉ có dòng khi chuyến có đối chiếu ở đó */}
          {VERIFY_CONTEXTS.filter((context) => context !== 'PICKUP' || VERIFY_METHODS.some((method) => report.verifications[context][method] > 0)).map((context) => (
            <tr key={context} className="h-10 border-t border-line-soft">
              <th scope="row" className="px-4.5 text-left font-medium text-ink-1">{t(`common.verifyContexts.${context}`)}</th>
              {VERIFY_METHODS.map((method) => (
                <td key={method} className="px-4.5 text-right font-mono text-ink-1 tabular-nums">{format.integer(report.verifications[context][method])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="m-0 border-t border-line-soft px-4.5 py-2.5 text-note text-ink-3">{t('tripReport.verify.note')}</p>
    </Card>
  )
}

/** Xác nhận tay của chuyến: kiện, bước, người gửi kèm lý do, và điều phối viên đã duyệt hay từ chối lúc nào. */
export function TripReportManualConfirms({ report, userNames, packageName }: { report: TripReport; userNames: Names; packageName: (instanceId: string) => string }) {
  const t = useT()
  const format = useFormat()
  const nameOf = (userId: string | null | undefined) => (userId === null || userId === undefined ? t('audit.log.system') : (userNames[userId] ?? t('tripReport.manual.unknownUser')))
  const moment = (iso: string) => `${format.time(iso)} · ${format.dayMonth(iso)}`
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
          {report.manualConfirms.map(({ id, context, stopNumber, packageInstanceId, at, by, manual }) => {
            const step = t(`common.verifyContexts.${context}`)
            const reason = t(`common.manualConfirmReasons.${manual.reason}`)
            return (
              <li key={id} className="flex flex-col gap-1 border-t border-line-soft px-4.5 py-3 text-small text-ink-2">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="font-mono font-semibold text-ink-strong">{packageInstanceId}</span>
                  <span className="text-ink-1">{packageName(packageInstanceId)}</span>
                  <Badge shape="tag" tone={CONFIRM_TONE[manual.status]}>{t(`tripReport.manual.statuses.${manual.status}`)}</Badge>
                </div>
                <span>{stopNumber === undefined ? step : t('tripReport.manual.step', { context: step, number: format.integer(stopNumber) })}</span>
                <span>{t('tripReport.manual.requested', { time: moment(at), name: nameOf(by), reason: manual.note ? `${reason} — ${manual.note}` : reason })}</span>
                {manual.decidedAt === undefined ? null : manual.status === 'MANUAL_REJECTED' ? (
                  <span>{t('tripReport.manual.rejected', { time: moment(manual.decidedAt), name: nameOf(manual.decidedBy), reason: manual.rejectReason ?? '' })}</span>
                ) : (
                  <span>{t('tripReport.manual.decided', { time: moment(manual.decidedAt), name: nameOf(manual.decidedBy) })}</span>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/** Sự cố cấp chuyến (ai báo, chuyển quản lý, gia hạn, xử lý) và các tuyến thay thế điều phối viên đã chọn — kết quả mock. */
export function TripReportIncidents({ report, userNames }: { report: TripReport; userNames: Names }) {
  const t = useT()
  const format = useFormat()
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
                <span className="font-mono text-small text-ink-3 tabular-nums">{exception.id}</span>
                <span className="font-semibold text-ink-strong">{t(`common.tripExceptionTypes.${exception.type}`)}</span>
                <ExceptionStatusChip status={exception.status} />
              </div>
              <p className="m-0 text-body text-ink-1">{exception.description}</p>
              <ExceptionFacts exception={exception} userNames={userNames} />
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
            {report.reroutes.map((reroute) => (
              <li key={reroute.confirmedAt}>
                {t('monitoring.reroute.current', {
                  time: `${format.time(reroute.confirmedAt)} · ${format.dayMonth(reroute.confirmedAt)}`, route: t(`monitoring.reroute.routes.${reroute.route}`),
                  km: format.decimal(reroute.distanceKm), minutes: format.integer(reroute.durationMinutes), number: format.integer(reroute.stopNumber),
                })}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </Card>
  )
}
