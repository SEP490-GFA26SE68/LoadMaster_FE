import type { ReactNode } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { VehicleName } from '@/components/VehicleName'
import { useFormat, useT } from '@/lib/i18n'
import type { TripReportData } from './trip-extras-api'

/**
 * Thông tin chuyến trong báo cáo (LM-104): tuyến, ngày, xe, tài xế, số seal kho ghi khi xếp xong, số kiện theo phương án / thiếu / xếp
 * bằng QR, khối lượng đã giao và bốn mốc giờ. Mốc chưa ghi thì "Chưa có".
 */
export function TripReportInfo({ data }: { data: TripReportData }) {
  const t = useT()
  const format = useFormat()
  const { trip, vehicle, driver, report } = data
  const { packages, times, seal, weight } = report
  const moment = (value: string | null) => (value === null ? t('tripReport.info.notYet') : `${format.time(value)} · ${format.date(value)}`)

  return (
    <Card className="flex flex-col print:break-inside-avoid print:shadow-none">
      <CardHeader>
        <CardTitle as="h2">{t('tripReport.info.title')}</CardTitle>
      </CardHeader>
      <p className="m-0 border-b border-line-soft px-4.5 py-3 text-body font-medium text-ink-strong">
        {t('tripReport.summary', { delivered: packages.delivered, planned: packages.planned, issues: report.issues.length })}
      </p>
      <dl className="m-0 grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-x-4 gap-y-2.5 px-4.5 py-4 text-body">
        <Fact label={t('tripReport.info.name')}>{trip.name}</Fact>
        <Fact label={t('tripReport.info.date')}>{format.date(trip.scheduledDate)}</Fact>
        <Fact label={t('tripReport.info.vehicle')}>
          {vehicle ? <><VehicleName name={vehicle.name} /> <span className="font-mono text-caption text-ink-3">{vehicle.id}</span></> : trip.vehicleId}
        </Fact>
        <Fact label={t('tripReport.info.driver')}>
          {driver ? <>{driver.fullName} <span className="font-mono text-caption text-ink-3">{driver.phone}</span></> : t('tripReport.info.noDriver')}
        </Fact>
        <Fact label={t('tripReport.info.seal')}>
          {seal
            ? <span className="font-mono">{t('tripReport.info.sealValue', { number: seal.number, time: format.time(seal.at) })}</span>
            : t('tripReport.info.noSeal')}
        </Fact>
        <Fact label={t('tripReport.info.planned')} mono>{format.integer(packages.planned)}</Fact>
        <Fact label={t('tripReport.info.damaged')} mono>{format.integer(packages.damaged)}</Fact>
        <Fact label={t('tripReport.info.loadedByQr')} mono>{format.integer(packages.loadedByQr)}</Fact>
        <Fact label={t('tripReport.info.weight')} mono>
          {t('tripReport.info.weightValue', { delivered: format.weight(weight.deliveredKg), planned: format.weight(weight.plannedKg) })}
        </Fact>
        <Fact label={t('tripReport.info.loadingStarted')}>{moment(times.loadingStartedAt)}</Fact>
        <Fact label={t('tripReport.info.loadingCompleted')}>{moment(times.loadingCompletedAt)}</Fact>
        <Fact label={t('tripReport.info.deliveryStarted')}>{moment(times.deliveryStartedAt)}</Fact>
        <Fact label={t('tripReport.info.deliveryCompleted')}>{moment(times.deliveryCompletedAt)}</Fact>
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
