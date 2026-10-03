import { PackageX, Search } from 'lucide-react'
import { useId, useState } from 'react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { useCan } from '@/features/auth/useCan'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import type { ShortageDecision } from '@/lib/mock-db'
import type { ShortageRow } from './shortage-api'
import { useResolveShortageMutation, useStagingShortagesQuery } from './useShortageQuery'

/**
 * "Kiện kho báo thiếu" ở Chi tiết chuyến (FE-6-02, D-82): các kiện kho không tìm thấy lúc soạn hàng — kiện, điểm giao, người báo, thời
 * điểm. Người sửa được chuyến (`trips.edit`, điều phối viên) quyết từng kiện: **Tìm tiếp** — báo thiếu đóng lại, kho soạn tiếp — hoặc
 * **Bỏ kiện khỏi chuyến** — hỏi lại trước vì chuyến quay về Đã lập kế hoạch: kiện về kho kiện kèm cờ "Không tìm thấy", yêu cầu giao của
 * nó thành giao thiếu, phương án lỗi thời và phải tối ưu lại, duyệt lại. Người chỉ xem (quản lý công ty) thấy danh sách và một dòng lý
 * do. Không còn báo thiếu nào thì thẻ không hiện.
 *
 * Mỗi dòng một cặp nút phụ: màn đã có nút chính của nó (mục 5: một nút chính mỗi màn).
 */
export function MissingPackagesCard({ tripId }: { tripId: string }) {
  const t = useT()
  const format = useFormat()
  const can = useCan()
  const titleId = useId()
  const query = useStagingShortagesQuery(tripId)
  const resolve = useResolveShortageMutation(tripId)
  const [dropping, setDropping] = useState<ShortageRow | null>(null)
  const rows = query.data ?? []
  if (rows.length === 0) return null
  const canDecide = can('trips.edit')

  function decide(row: ShortageRow, decision: ShortageDecision) {
    resolve.mutate({ packageInstanceId: row.packageInstanceId, decision }, {
      onSuccess: () => {
        setDropping(null)
        if (decision === 'DROP') toast.success(t('trips.shortages.dropped', { id: row.packageInstanceId }), { description: t('trips.shortages.droppedDescription') })
        else toast.success(t('trips.shortages.kept', { id: row.packageInstanceId }))
      },
      onError: (error) => toast.error(dataErrorMessage(error, t)),
    })
  }

  return (
    <Card role="region" aria-labelledby={titleId} className="border-amber-200">
      <CardHeader>
        <CardTitle id={titleId}>{t('trips.shortages.title')}</CardTitle>
        <Badge tone="warning" dot="ring">{t('trips.shortages.count', { count: rows.length })}</Badge>
        <CardMeta className="basis-full">{t('trips.shortages.description')}</CardMeta>
      </CardHeader>
      <ul className="flex flex-col divide-y divide-line-soft">
        {rows.map((row) => (
          <li key={row.packageInstanceId} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4.5 py-3">
            <div className="flex min-w-0 flex-1 basis-80 flex-col gap-0.5">
              <span className="flex min-w-0 flex-wrap items-baseline gap-x-2">
                <span className="font-mono text-body font-semibold text-ink-strong">{row.packageInstanceId}</span>
                <span className="text-body text-ink-1">{row.packageName}</span>
                <span className="text-small text-ink-2">{t('common.stop', { number: row.stopNumber })}</span>
              </span>
              <span className="text-small text-ink-2">
                {t('trips.shortages.reportedBy', {
                  name: row.reporterName ?? t('trips.shortages.unknownReporter'),
                  time: format.time(row.at),
                  date: format.dayMonth(row.at),
                })}
              </span>
            </div>
            {canDecide ? (
              <div className="flex flex-none items-center gap-2">
                <Button variant="ghost" size="sm" disabled={resolve.isPending} aria-label={t('trips.shortages.dropLabel', { id: row.packageInstanceId })} onClick={() => setDropping(row)}>
                  <PackageX strokeWidth={1.5} />
                  {t('trips.shortages.drop')}
                </Button>
                <Button variant="secondary" size="sm" disabled={resolve.isPending} aria-label={t('trips.shortages.keepLabel', { id: row.packageInstanceId })} onClick={() => decide(row, 'KEEP_SEARCHING')}>
                  <Search strokeWidth={1.5} />
                  {t('trips.shortages.keep')}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {canDecide ? null : <p className="border-t border-line-soft px-4.5 py-2.5 text-note text-ink-3">{t('trips.shortages.readOnly')}</p>}
      <ConfirmDialog
        open={dropping !== null}
        onOpenChange={(open) => { if (!open) setDropping(null) }}
        title={t('trips.shortages.dropDialog.title', { id: dropping?.packageInstanceId ?? '' })}
        description={t('trips.shortages.dropDialog.description')}
        cancelLabel={t('trips.shortages.dropDialog.cancel')}
        confirmLabel={t('trips.shortages.dropDialog.confirm')}
        danger
        pending={resolve.isPending}
        onConfirm={() => { if (dropping) decide(dropping, 'DROP') }}
      />
    </Card>
  )
}
