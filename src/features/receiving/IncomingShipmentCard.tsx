import { useId } from 'react'
import { Badge, type BadgeDot, type BadgeTone } from '@/components/ui/Badge'
import { Card, CardActions, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { ProgressBar } from '@/components/ui/ProgressBar'
import type { ShipmentStatus } from '@/lib/mock-db'
import { useFormat, useT } from '@/lib/i18n'
import type { IncomingShipment } from './receiving-api'
import { shipmentProgress } from './receiving-view'

/** Ngữ pháp chấm V2.3: đã bàn giao = chờ bạn quét (vòng rỗng hổ phách), đang nhận = đang chạy (xanh lam có quầng), nhận đủ = xong. */
const STATUS_LOOK: Record<ShipmentStatus, { tone: BadgeTone; dot: BadgeDot }> = {
  draft: { tone: 'neutral', dot: 'solid' },
  handed_over: { tone: 'warning', dot: 'ring' },
  partially_received: { tone: 'azure', dot: 'halo' },
  received: { tone: 'success', dot: 'solid' },
}

/** Số kiện chờ quét hiện tên; phần còn lại gộp một dòng để card không dài theo cỡ lô. */
const PENDING_SHOWN = 8

/**
 * Một lô đang về ở màn nhận hàng (LM-104): mã lô, trạng thái, nhà sản xuất, giờ bàn giao, thước đo đã nhận x / y và các kiện còn chờ
 * quét (mã + loại) để người nhận biết còn thiếu kiện nào.
 */
export function IncomingShipmentCard({ row }: { row: IncomingShipment }) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const progress = shipmentProgress(row)
  const look = STATUS_LOOK[row.shipment.status]
  const handedOverAt = row.shipment.handedOverAt
  const hidden = row.pending.length - PENDING_SHOWN

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle id={titleId} className="font-mono">{row.shipment.id}</CardTitle>
        <Badge tone={look.tone} dot={look.dot}>{t(`sourcing.shipments.status.${row.shipment.status}`)}</Badge>
        {row.manufacturer ? <CardMeta>{t('sourcing.receiving.from', { name: row.manufacturer.name })}</CardMeta> : null}
        {handedOverAt ? (
          <CardActions>
            <CardMeta className="tabular-nums">
              {t('sourcing.receiving.handedOver', { time: format.time(handedOverAt), date: format.dayMonth(handedOverAt) })}
            </CardMeta>
          </CardActions>
        ) : null}
      </CardHeader>
      <div className="flex flex-col gap-4 p-4.5">
        <ProgressBar
          label={t('sourcing.receiving.progress', { received: format.integer(progress.received), total: format.integer(progress.total) })}
          value={progress.percent}
        />
        {row.pending.length === 0 ? (
          <p className="text-small text-ink-3">{t('sourcing.receiving.allReceived')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            <h4 className="text-small font-semibold text-ink-2">{t('sourcing.receiving.pendingTitle')}</h4>
            <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
              {row.pending.slice(0, PENDING_SHOWN).map(({ package: pkg, type }) => (
                <li key={pkg.id} className="flex min-w-0 items-baseline gap-2 text-small">
                  <span className="flex-none font-mono text-caption text-ink-1 tabular-nums">{pkg.id}</span>
                  <span className="truncate text-ink-2">{type?.name ?? t('sourcing.receiving.unknownType')}</span>
                </li>
              ))}
            </ul>
            {hidden > 0 ? <p className="text-small text-ink-3">{t('sourcing.receiving.more', { count: hidden })}</p> : null}
          </div>
        )}
      </div>
    </Card>
  )
}
