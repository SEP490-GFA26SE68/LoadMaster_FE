import { ArrowDownUp, CalendarDays, ChevronDown, Search, X } from 'lucide-react'
import { useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select'
import type { ListUrlState } from '@/components/useListUrlState'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { dateOnly } from './trip-dates'
import type { FilterOption, TripListFilter } from './trip-list'

/** Radix Select không cho `SelectItem` mang `value=""`, nên dòng "Tất cả" dùng giá trị riêng rồi đổi về `''`. */
const ALL = '*'

/** Chip lọc V2.3 (`v3.css` `.chip`): cao 32, viền 1px, chữ 500; đang lọc thì nền cyan nhạt (`.chip.on`). */
function chipClass(active: boolean) {
  return cn(
    'h-8 w-auto flex-none gap-1.5 rounded-md px-2.75 text-body font-medium whitespace-nowrap',
    active ? 'border-cyan-300 bg-cyan-50 text-cyan-800' : 'border-border bg-bg text-ink-2 hover:border-line-strong',
  )
}

/** Chữ đang gõ giữ tại chỗ: router đổi URL trong transition (như `FilterBar`); giá trị ngoài đổi (xoá lọc) thì ô theo. */
function useDraft(value: string) {
  const [draft, setDraft] = useState(value)
  const [source, setSource] = useState(value)
  if (value !== source) {
    setSource(value)
    setDraft(value)
  }
  return [draft, setDraft] as const
}

function ChipSelect({ label, value, options, allLabel, onChange }: {
  label: string
  value: string
  options: readonly FilterOption[]
  allLabel: string
  onChange: (value: string) => void
}) {
  const t = useT()
  const shown = options.find((option) => option.value === value)?.label ?? t('trips.list.chipAll')
  return (
    <Select value={value === '' ? ALL : value} onValueChange={(next) => onChange(next === ALL ? '' : next)}>
      <SelectTrigger aria-label={label} className={chipClass(value !== '')}>
        <SelectValue>{t('trips.list.chip', { label, value: shown })}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
      </SelectContent>
    </Select>
  )
}

/**
 * Đầu thẻ bảng chuyến V2.3 (`ChuyenHang.jpg` `.toolbar`): ô tìm 340px, chip lọc ngày chạy / xe / tài xế, "Xoá lọc" khi đang lọc, và
 * cách sắp bên phải ("Nhóm theo ngày chạy · mới nhất trước" — bấm để đảo chiều, hoặc để quay lại nhóm theo ngày khi đang sắp theo cột
 * khác). Chip ngày chạy mở một hàng hai ô ngày ngay dưới (không có popover trong bộ primitive); đang lọc ngày thì hàng mở sẵn.
 */
export function TripListToolbar({ list, vehicles, drivers, grouped, newestFirst, onGroupByDate }: {
  list: ListUrlState<TripListFilter>
  vehicles: readonly FilterOption[]
  drivers: readonly FilterOption[]
  grouped: boolean
  newestFirst: boolean
  onGroupByDate: () => void
}) {
  const t = useT()
  const format = useFormat()
  const searchRef = useRef<HTMLInputElement>(null)
  const datePanelId = useId()
  const [query, setQuery] = useDraft(list.query)
  const { tu: from, den: to } = list.filters
  const [fromDraft, setFromDraft] = useDraft(from)
  const [toDraft, setToDraft] = useDraft(to)
  const hasDate = from !== '' || to !== ''
  const [dateOpen, setDateOpen] = useState(hasDate)
  const day = (value: string) => format.date(dateOnly(value))
  const dateValue = from && to ? t('trips.list.dateRange', { from: day(from), to: day(to) })
    : from ? t('trips.list.dateFrom', { date: day(from) })
    : to ? t('trips.list.dateTo', { date: day(to) })
    : t('trips.list.chipAll')
  const allLabel = t('common.filters.all')

  function handleClear() {
    list.clearAll()
    searchRef.current?.focus()
  }

  return (
    <div role="search" aria-label={t('common.filters.region')} className="flex flex-col gap-3 border-b border-line-soft px-3.5 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-85 max-w-full">
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-text-3" strokeWidth={1.5} />
          <Input
            ref={searchRef}
            type="search"
            aria-label={t('trips.list.search')}
            placeholder={t('trips.list.search')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              list.setQuery(event.target.value)
            }}
            className="h-9 pl-9"
          />
        </div>
        <button
          type="button"
          aria-expanded={dateOpen}
          aria-controls={dateOpen ? datePanelId : undefined}
          onClick={() => setDateOpen((open) => !open)}
          className={cn('inline-flex items-center border outline-none focus-visible:border-cyan-500 focus-visible:shadow-focus', chipClass(hasDate))}
        >
          <CalendarDays aria-hidden className="size-4" strokeWidth={1.5} />
          {t('trips.list.chip', { label: t('trips.list.date'), value: dateValue })}
          <ChevronDown aria-hidden className={cn('size-4 text-n-600 transition-transform duration-(--dur-fast)', dateOpen && 'rotate-180')} strokeWidth={1.5} />
        </button>
        <ChipSelect label={t('trips.list.vehicle')} value={list.filters.xe} options={vehicles} allLabel={allLabel} onChange={(value) => list.setFilter('xe', value)} />
        <ChipSelect label={t('trips.list.driver')} value={list.filters['tai-xe']} options={drivers} allLabel={allLabel} onChange={(value) => list.setFilter('tai-xe', value)} />
        {list.isFiltering ? (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X strokeWidth={1.5} />
            {t('common.filters.clear')}
          </Button>
        ) : null}
        <Button variant="ghost" size="sm" className="ml-auto text-ink-3" onClick={onGroupByDate}>
          <ArrowDownUp strokeWidth={1.5} />
          {grouped ? t(newestFirst ? 'trips.list.group.byDateDesc' : 'trips.list.group.byDateAsc') : t('trips.list.group.byDate')}
        </Button>
      </div>
      {dateOpen ? (
        <div id={datePanelId} role="group" aria-label={t('trips.list.date')} className="flex flex-wrap items-center gap-2">
          <div className="w-40">
            <Input
              type="date"
              aria-label={t('common.filters.from')}
              value={fromDraft}
              max={toDraft || undefined}
              onChange={(event) => {
                setFromDraft(event.target.value)
                list.setFilter('tu', event.target.value)
              }}
              className="h-9"
            />
          </div>
          <span aria-hidden className="text-body text-text-3">–</span>
          <div className="w-40">
            <Input
              type="date"
              aria-label={t('common.filters.to')}
              value={toDraft}
              min={fromDraft || undefined}
              onChange={(event) => {
                setToDraft(event.target.value)
                list.setFilter('den', event.target.value)
              }}
              className="h-9"
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
