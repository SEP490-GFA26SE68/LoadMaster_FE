import { Printer, X } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { labelsPath } from './packages-list'

/** Dải thao tác trên kiện đang chọn (LM-104), nằm giữa thanh tìm và bảng: số đã chọn, bỏ chọn, in nhãn QR. */
export function PackageSelectionBar({ selected, onClear }: {
  selected: readonly string[]
  onClear: () => void
}) {
  const t = useT()
  return (
    <div role="region" aria-label={t('sourcing.packages.selection.count', { count: selected.length })} className="flex flex-wrap items-center gap-2.5 border-b border-border bg-primary-bg px-4 py-2.5">
      <span className="font-display text-body font-semibold text-ink-strong tabular-nums">{t('sourcing.packages.selection.count', { count: selected.length })}</span>
      <Button variant="ghost" size="sm" onClick={onClear}>
        <X strokeWidth={1.5} />
        {t('sourcing.packages.selection.clear')}
      </Button>
      <Button variant="secondary" size="sm" className="ml-auto" asChild>
        <Link to={labelsPath(selected)}>
          <Printer strokeWidth={1.5} />
          {t('sourcing.packages.selection.printLabels')}
        </Link>
      </Button>
    </div>
  )
}
