
import { Search } from 'lucide-react'
import {
  useId,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  fieldBoxClass,
  focusWithinClass,
} from '@/components/ui/field-styles'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import {
  resolveAddress,
  type AddressSuggestion,
  type ResolvedAddress,
} from './places-api'
import { usePlaceSearchQuery } from './usePlaceSearchQuery'

export function PlaceSearchBox({
  onPick,
}: {
  onPick: (place: ResolvedAddress) => void
}) {
  const t = useT()
  const listId = useId()

  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pickError, setPickError] = useState(false)

  const search = usePlaceSearchQuery(query)
  const wanted = query.trim()

  // Không cho chọn kết quả thuộc từ khóa cũ.
  const results =
    wanted.length < 2 || search.isPlaceholderData
      ? []
      : (search.data ?? [])

  const active = Math.min(
    activeIndex,
    Math.max(0, results.length - 1),
  )

  const open = wanted.length >= 2

  const optionId = (index: number) => `${listId}-${index}`

  async function pick(place: AddressSuggestion) {
    if (busyId !== null) return

    setBusyId(place.placeId)
    setPickError(false)

    try {
      const resolved = await resolveAddress(place)

      onPick(resolved)
      setQuery('')
      setActiveIndex(0)
    } catch {
      setPickError(true)
    } finally {
      setBusyId(null)
    }
  }

  function handleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (
      event.key === 'ArrowDown' ||
      event.key === 'ArrowUp'
    ) {
      if (results.length === 0) return

      event.preventDefault()

      setActiveIndex(
        (active +
          (event.key === 'ArrowDown'
            ? 1
            : results.length - 1)) %
          results.length,
      )

      return
    }

    if (event.key === 'Enter' && open) {
      event.preventDefault()

      const place = results[active]

      if (place) void pick(place)

      return
    }

    if (event.key === 'Escape' && query !== '') {
      event.stopPropagation()
      setQuery('')
      setPickError(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          'flex h-10 items-center gap-2 px-3',
          fieldBoxClass(false),
          focusWithinClass,
        )}
      >
        <Search
          aria-hidden
          className="size-4 flex-none text-ink-3"
          strokeWidth={1.75}
        />

        <input
          type="text"
          role="combobox"
          aria-label={t('map.picker.search')}
          aria-autocomplete="list"
          aria-expanded={open && results.length > 0}
          aria-controls={
            open && results.length > 0
              ? listId
              : undefined
          }
          aria-activedescendant={
            open && results.length > 0
              ? optionId(active)
              : undefined
          }
          aria-busy={search.isFetching || busyId !== null}
          autoComplete="off"
          placeholder={t('map.picker.searchPlaceholder')}
          value={query}
          disabled={busyId !== null}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setPickError(false)
          }}
          onKeyDown={handleKeyDown}
          className="h-auto w-full min-w-0 border-none bg-transparent px-0 text-body text-text outline-none placeholder:text-text-3"
        />
      </div>

      {search.isError && open ? (
        <p role="alert" className="text-fine text-danger">
          {t('map.picker.searchFailed')}
        </p>
      ) : null}

      {pickError ? (
        <p role="alert" className="text-fine text-danger">
          {t('map.picker.detailFailed')}
        </p>
      ) : null}

      {open && search.isFetching ? (
        <p role="status" className="text-fine text-ink-3">
          {t('map.picker.searching')}
        </p>
      ) : null}

      {open &&
      !search.isFetching &&
      !search.isError &&
      results.length === 0 ? (
        <p role="status" className="text-fine text-ink-3">
          {t('map.picker.noResults', {
            query: wanted,
          })}
        </p>
      ) : null}

      {open && results.length > 0 ? (
        <ul
          role="listbox"
          id={listId}
          aria-label={t('map.picker.results')}
          className="m-0 flex list-none flex-col rounded-md border border-border bg-bg p-1"
        >
          {results.map((place, index) => (
            <li
              key={place.placeId}
              id={optionId(index)}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) =>
                event.preventDefault()
              }
              onMouseEnter={() =>
                setActiveIndex(index)
              }
              onClick={() => void pick(place)}
              className={cn(
                'flex cursor-pointer flex-col gap-0.5 rounded-sm px-2.5 py-2',
                index === active && 'bg-cyan-50',
                busyId !== null && 'opacity-60',
              )}
            >
              <span className="text-body font-medium text-ink-strong">
                {place.name}
              </span>

              <span className="text-small text-ink-3">
                {place.address}
              </span>

              {busyId === place.placeId ? (
                <span className="text-caption text-ink-3">
                  {t('map.picker.resolving')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
