import { ChevronDown, Search } from 'lucide-react'
import type { ReactNode } from 'react'
import { Input } from '@/components/ui/Input'
import { fieldBoxClass, focusClass } from '@/components/ui/field-styles'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { StopRow } from './trip-summary'

/**
 * Thanh lọc của bảng kiện (V2.3 `.tbar`): ô tìm 34 px tối đa 300 px, ô chọn điểm giao 224 px, hai chip bật/tắt. Ô chọn điểm giao giữ
 * `<select>` gốc — cùng bộ lọc với danh sách điểm giao bên trái, giá trị đọc được bằng `value` — nhưng mang vỏ ô nhập V2.3.
 */
export function PackagesToolbar({
  stops, query, onQueryChange, stopFilter, onStopFilterChange, onlyFragile, onOnlyFragileChange, onlyIssues, onOnlyIssuesChange,
}: {
  stops: readonly StopRow[]
  query: string
  onQueryChange: (query: string) => void
  stopFilter: number | null
  onStopFilterChange: (stop: number | null) => void
  onlyFragile: boolean
  onOnlyFragileChange: (next: boolean) => void
  onlyIssues: boolean
  onOnlyIssuesChange: (next: boolean) => void
}) {
  const t = useT()
  return (
    <div role="search" aria-label={t('common.filters.region')} className="flex flex-wrap items-center gap-2 border-b border-line-soft px-4 py-2.5">
      <div className="relative min-w-48 flex-1 basis-56 lg:max-w-75">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 z-1 size-4 -translate-y-1/2 text-ink-3" strokeWidth={1.5} />
        <Input type="search" aria-label={t('trips.packages.search')} placeholder={t('trips.packages.search')} value={query}
          onChange={(event) => onQueryChange(event.target.value)} className="h-8.5 pl-9" />
      </div>
      <div className="relative w-56 flex-none">
        <select
          aria-label={t('trips.packages.filterStop')}
          value={stopFilter ?? ''}
          onChange={(event) => onStopFilterChange(event.target.value === '' ? null : Number(event.target.value))}
          className={cn('h-8.5 w-full cursor-pointer appearance-none truncate pr-9 pl-3', fieldBoxClass(false), focusClass)}
        >
          <option value="">{t('trips.packages.allStops')}</option>
          {stops.map((stop) => <option key={stop.id} value={stop.number}>{stop.number} · {stop.name}</option>)}
        </select>
        <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-n-600" strokeWidth={1.5} />
      </div>
      <FilterChip pressed={onlyFragile} onToggle={onOnlyFragileChange}>{t('trips.packages.onlyFragile')}</FilterChip>
      <FilterChip pressed={onlyIssues} onToggle={onOnlyIssuesChange}>{t('trips.packages.onlyIssues')}</FilterChip>
    </div>
  )
}

/** Chip lọc bật/tắt V2.3 (`.chip`, `.chip.on`): cao 32, bo 10, viền `--border`; đang bật nền cyan-50, viền cyan-300, chữ cyan-800. */
function FilterChip({ pressed, onToggle, children }: { pressed: boolean; onToggle: (next: boolean) => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={() => onToggle(!pressed)}
      className={cn(
        'h-8.5 rounded-md border px-3 text-body font-medium whitespace-nowrap transition-colors duration-(--dur-fast) ease-standard',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        pressed ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-border bg-bg text-ink-2 hover:bg-surface hover:text-ink-1',
      )}
    >
      {children}
    </button>
  )
}
