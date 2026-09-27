import { PackageCheck } from 'lucide-react'
import { useId } from 'react'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import type { IncomingShipment } from './receiving-api'
import { recentReceipts } from './receiving-view'

const LIMIT = 8

/** Cột "Vừa nhận" của màn nhận hàng (LM-104): tám kiện quét nhận gần nhất, theo giờ kho ghi trên kiện. */
export function RecentReceipts({ rows }: { rows: readonly IncomingShipment[] }) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  const receipts = recentReceipts(rows, LIMIT)

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle id={titleId}>{t('sourcing.receiving.recent')}</CardTitle>
      </CardHeader>
      {receipts.length === 0 ? (
        <p className="p-4.5 text-small text-ink-3">{t('sourcing.receiving.recentEmpty')}</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {receipts.map(({ item, row, at }) => (
            <li key={item.package.id} className="flex items-start gap-3 px-4.5 py-3">
              <span aria-hidden className="grid size-8 flex-none place-items-center rounded-md bg-tint-green text-tint-green-fg">
                <PackageCheck className="size-4" strokeWidth={1.5} />
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex min-w-0 items-baseline gap-2">
                  <span className="flex-none font-mono text-caption font-medium text-ink-strong tabular-nums">{item.package.id}</span>
                  <span className="truncate text-small text-ink-1">{item.type?.name ?? t('sourcing.receiving.unknownType')}</span>
                </span>
                <span className="text-note text-ink-3 tabular-nums">
                  {t('sourcing.receiving.recentMeta', { shipment: row.shipment.id, time: format.time(at), date: format.dayMonth(at) })}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
