import { Search } from 'lucide-react'
import { useId, useState, type KeyboardEvent } from 'react'
import { fieldBoxClass, focusWithinClass } from '@/components/ui/field-styles'
import { useT } from '@/lib/i18n'
import type { Place } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import { formatCoordinate } from './coordinates'
import { usePlaceSearchQuery } from './usePlaceSearchQuery'

/**
 * Ô tìm địa danh của ô chọn toạ độ (FE-4b-03): combobox + listbox (`aria-activedescendant`, con trỏ ở ô nhập — AGENTS mục 10). Gõ là
 * tìm (bỏ dấu); ↑ / ↓ đổi dòng, Enter chọn, Esc xoá từ khoá. Danh sách nằm ngay dưới ô, trong luồng trang — không phải lớp nổi, nên
 * dùng được trong hộp thoại. Mỗi dòng: tên, vùng, loại địa danh và toạ độ mono.
 */
export function PlaceSearchBox({ onPick }: { onPick: (place: Place) => void }) {
  const t = useT()
  const listId = useId()
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const search = usePlaceSearchQuery(query)
  const wanted = query.trim()
  const results = wanted === '' ? [] : (search.data ?? [])
  const active = Math.min(activeIndex, Math.max(0, results.length - 1))
  const optionId = (index: number) => `${listId}-${index}`
  const open = wanted !== '' && search.data !== undefined

  function pick(place: Place) {
    onPick(place)
    setQuery('')
    setActiveIndex(0)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (results.length === 0) return
      event.preventDefault()
      setActiveIndex((active + (event.key === 'ArrowDown' ? 1 : results.length - 1)) % results.length)
      return
    }
    if (event.key === 'Enter') {
      // Ô nằm trong form: Enter chọn địa danh đang tô, không gửi form
      event.preventDefault()
      const place = results[active]
      if (place) pick(place)
      return
    }
    if (event.key === 'Escape' && query !== '') {
      event.stopPropagation()
      setQuery('')
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className={cn('flex h-10 items-center gap-2 px-3', fieldBoxClass(false), focusWithinClass)}>
        <Search aria-hidden className="size-4 flex-none text-ink-3" strokeWidth={1.75} />
        <input
          type="text"
          role="combobox"
          aria-label={t('map.picker.search')}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={open && results.length > 0 ? listId : undefined}
          aria-activedescendant={open && results.length > 0 ? optionId(active) : undefined}
          autoComplete="off"
          placeholder={t('map.picker.searchPlaceholder')}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActiveIndex(0) }}
          onKeyDown={handleKeyDown}
          className="h-auto w-full min-w-0 border-none bg-transparent px-0 text-body text-text outline-none placeholder:text-text-3"
        />
      </div>
      {open ? (
        results.length === 0 ? (
          <p role="status" className="text-fine text-ink-3">{t('map.picker.noResults', { query: wanted })}</p>
        ) : (
          <ul role="listbox" id={listId} aria-label={t('map.picker.results')} className="m-0 flex list-none flex-col rounded-md border border-border bg-bg p-1">
            {results.map((place, index) => (
              <li
                key={place.id}
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                // Giữ con trỏ ở ô nhập: bấm chuột không lấy focus của ô
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => pick(place)}
                className={cn('flex cursor-pointer flex-wrap items-baseline gap-x-2 rounded-sm px-2.5 py-1.5', index === active && 'bg-cyan-50')}
              >
                <span className="text-body font-medium text-ink-strong">{place.name}</span>
                <span className="text-small text-ink-3">{place.region} · {t(`map.picker.kind.${place.kind}`)}</span>
                <span className="ml-auto font-mono text-caption text-ink-3 tabular-nums">{formatCoordinate(place.lat)}, {formatCoordinate(place.lng)}</span>
              </li>
            ))}
          </ul>
        )
      ) : null}
    </div>
  )
}
