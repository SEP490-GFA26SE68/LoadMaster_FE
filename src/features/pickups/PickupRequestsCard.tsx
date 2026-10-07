import { PackagePlus } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardActions, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { useCan } from '@/features/auth/useCan'
import { useT } from '@/lib/i18n'
import type { TripPhase } from '@/lib/mock-db'
import { PickupRequestDialog } from './PickupRequestDialog'
import { PickupRequestItem } from './PickupRequestItem'
import { stopLabeler, type StopRef } from './pickup-stops'
import { usePickupRequestsQuery } from './usePickupsQuery'

/**
 * "Nhận hàng dọc đường" của một chuyến (FE-7-03, D-88): danh sách yêu cầu nhận kèm trạng thái, mười luật Đạt / Không đạt và hành động
 * của điều phối viên. Nút "Nhận hàng dọc đường" (theo `pickups.create`) mở hộp tạo yêu cầu; chuyến không còn Đang vận chuyển thì nút mờ
 * kèm lý do ngay tại chỗ. Thẻ chỉ hiện khi chuyến đang vận chuyển hoặc đã có yêu cầu — không có gì để nói ở chuyến chưa chạy.
 * Dùng ở Chi tiết chuyến và Giám sát; tài xế có lối riêng ở màn điểm giao (`PickupDriverEntry`).
 */
export function PickupRequestsCard({ tripId, phase, stops }: { tripId: string; phase: TripPhase; stops: readonly StopRef[] }) {
  const t = useT()
  const can = useCan()
  const titleId = useId()
  const blockedId = useId()
  const query = usePickupRequestsQuery(tripId)
  const [creating, setCreating] = useState(false)
  const stopLabel = useMemo(() => stopLabeler(stops, t), [stops, t])
  const rows = query.data ?? []
  const inTransit = phase === 'delivering'
  if (!inTransit && rows.length === 0) return null

  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle id={titleId}>{t('pickups.card.title')}</CardTitle>
        {rows.length > 0 ? <Badge tone="neutral">{t('pickups.card.count', { count: rows.length })}</Badge> : null}
        <CardMeta className="basis-full">{t('pickups.card.description')}</CardMeta>
        {can('pickups.create') ? (
          <CardActions>
            <Button variant="secondary" size="sm" disabled={!inTransit} aria-describedby={inTransit ? undefined : blockedId} onClick={() => setCreating(true)}>
              <PackagePlus strokeWidth={1.5} />
              {t('pickups.open')}
            </Button>
          </CardActions>
        ) : null}
      </CardHeader>
      {query.isPending ? (
        <div role="status" aria-label={t('pickups.card.loading')} className="grid place-items-center py-6"><Spinner /></div>
      ) : rows.length === 0 ? (
        <p className="m-0 px-4.5 pb-4 text-small text-ink-3">{t('pickups.card.empty')}</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-line-soft border-t border-line-soft p-0">
          {rows.map((row) => <PickupRequestItem key={row.request.id} tripId={tripId} row={row} stopLabel={stopLabel} />)}
        </ul>
      )}
      {!inTransit && can('pickups.create') ? <p id={blockedId} className="m-0 border-t border-line-soft px-4.5 py-2.5 text-note text-ink-3">{t('pickups.blocked')}</p> : null}
      {can('pickups.create') ? <PickupRequestDialog tripId={tripId} stops={stops} open={creating} onOpenChange={setCreating} /> : null}
    </Card>
  )
}
