import type { ReactNode } from 'react'
import { Banner } from '@/components/Banner'
import { Card, CardBody, CardHeader, CardTitle } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useFormat, useT } from '@/lib/i18n'
import type { ShipmentDetail } from './shipments-api'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line-soft py-2.5 last:border-b-0">
      <dt className="text-small text-ink-3">{label}</dt>
      <dd className="text-body text-ink-1">{children}</dd>
    </div>
  )
}

/**
 * Cột phải của chi tiết lô (LM-104): thước đo đã nhận ở kho logistics (x / y kiện, đếm từ lần quét nhận của kho), rồi thông tin lô —
 * công ty nhận, nhà sản xuất, lúc tạo, lúc bàn giao, ghi chú. Lô nháp có một dòng nói bàn giao làm gì.
 */
export function ShipmentInfoCard({ detail }: { detail: ShipmentDetail }) {
  const t = useT()
  const format = useFormat()
  const { shipment } = detail
  const count = shipment.packageIds.length
  const percent = count === 0 ? 0 : (detail.receivedCount / count) * 100
  const at = (value: string) => `${format.time(value)} ${format.date(value)}`
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle as="h2">{t('sourcing.shipments.detail.info')}</CardTitle>
      </CardHeader>
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <ProgressBar label={t('sourcing.shipments.detail.progress')} value={percent} />
          <span className="font-mono text-caption text-ink-2 tabular-nums">
            {t('sourcing.shipments.detail.receivedOf', { count, received: format.integer(detail.receivedCount) })}
          </span>
        </div>
        {shipment.status === 'draft' ? <Banner tone="info">{t('sourcing.shipments.detail.draftNote')}</Banner> : null}
        <dl className="m-0 flex flex-col">
          <Row label={t('sourcing.shipments.detail.logistics')}>{detail.logistics?.name ?? shipment.logisticsCompanyId}</Row>
          <Row label={t('sourcing.shipments.detail.manufacturer')}>{detail.manufacturer?.name ?? shipment.manufacturerId}</Row>
          <Row label={t('sourcing.shipments.detail.createdAt')}><span className="font-mono text-caption tabular-nums">{at(shipment.createdAt)}</span></Row>
          <Row label={t('sourcing.shipments.detail.handedOverAt')}>
            {shipment.handedOverAt
              ? <span className="font-mono text-caption tabular-nums">{at(shipment.handedOverAt)}</span>
              : <span className="text-ink-3">{t('sourcing.shipments.detail.notHandedOver')}</span>}
          </Row>
          <Row label={t('sourcing.shipments.detail.note')}>
            {shipment.note ? <span className="whitespace-pre-line">{shipment.note}</span> : <span className="text-ink-3">{t('sourcing.shipments.detail.noNote')}</span>}
          </Row>
        </dl>
      </CardBody>
    </Card>
  )
}
