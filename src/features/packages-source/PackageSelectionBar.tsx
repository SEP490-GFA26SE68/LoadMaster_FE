import { PackageCheck, Printer, X } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { createShipmentPath, labelsPath } from './packages-list'

/**
 * Dải thao tác trên kiện đang chọn (LM-104), nằm giữa thanh tìm và bảng: số đã chọn, bỏ chọn, in nhãn QR, tạo lô hàng. Tạo lô chỉ lấy
 * kiện còn đưa vào lô được; kiện đã chọn mà không đưa được thì nói ngay tại chỗ, không để bấm rồi mới báo lỗi.
 */
export function PackageSelectionBar({ selected, shippable, onClear }: {
  selected: readonly string[]
  shippable: readonly string[]
  onClear: () => void
}) {
  const t = useT()
  const blocked = selected.length - shippable.length
  return (
    <div role="region" aria-label={t('sourcing.packages.selection.count', { count: selected.length })} className="flex flex-col gap-1.5 border-b border-border bg-primary-bg px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="font-display text-body font-semibold text-ink-strong tabular-nums">{t('sourcing.packages.selection.count', { count: selected.length })}</span>
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X strokeWidth={1.5} />
          {t('sourcing.packages.selection.clear')}
        </Button>
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" asChild>
            <Link to={labelsPath(selected)}>
              <Printer strokeWidth={1.5} />
              {t('sourcing.packages.selection.printLabels')}
            </Link>
          </Button>
          {shippable.length > 0 ? (
            <Button variant="secondary" size="sm" asChild>
              <Link to={createShipmentPath(shippable)}>
                <PackageCheck strokeWidth={1.5} />
                {t('sourcing.packages.selection.createShipment')}
              </Link>
            </Button>
          ) : (
            <Button variant="secondary" size="sm" disabled>
              <PackageCheck strokeWidth={1.5} />
              {t('sourcing.packages.selection.createShipment')}
            </Button>
          )}
        </span>
      </div>
      {blocked > 0 ? <p className="text-fine text-ink-2">{t('sourcing.packages.selection.notShippable', { count: blocked })}</p> : null}
    </div>
  )
}
