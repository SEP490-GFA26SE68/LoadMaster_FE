import { Search } from 'lucide-react'
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Button } from '@/components/ui/Button'
import { useFormat, useT } from '@/lib/i18n'
import { searchSources, type SearchGroup } from './quick-search'
import { SearchKbd } from './SearchKbd'
import { SearchResults } from './SearchResults'
import { SHORTCUT_KEYS } from './shortcut'
import { useSearchSourcesQuery } from './useSearchSourcesQuery'

/**
 * Nội dung hộp thoại tìm nhanh (LM-099; V2.3 TimNhanh, kính tối): ô nhập là combobox, kết quả là listbox chia nhóm. Hàng ô nhập có
 * số kết quả (vùng `status`, trình đọc màn hình nghe mỗi lần gõ) và gợi ý `Esc`. Mũi tên lên/xuống chọn (vòng tròn), Enter mở, Esc
 * đóng (Radix Dialog). Gắn khi hộp thoại mở nên mỗi lần mở là ô trống và dữ liệu đọc lại từ kho.
 */
export function QuickSearchPanel({ groups, onOpenResult }: { groups: readonly SearchGroup[]; onOpenResult: (href: string) => void }) {
  const t = useT()
  const format = useFormat()
  const [query, setQuery] = useState('')
  const [activeKey, setActiveKey] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const sources = useSearchSourcesQuery(groups)

  const resultGroups = useMemo(() => (sources.data ? searchSources(sources.data, query, groups) : []), [sources.data, query, groups])
  const flat = useMemo(() => resultGroups.flatMap((entry) => entry.results), [resultGroups])
  const indexOf = useMemo(() => new Map(flat.map((result, index) => [result.key, index])), [flat])
  // Chưa chọn gì (vừa gõ) thì dòng đầu là dòng đang chọn
  const activeIndex = activeKey === null ? 0 : (indexOf.get(activeKey) ?? 0)
  const active = flat[activeIndex]
  const optionId = (index: number) => `${listId}-${index}`
  const activeId = active ? optionId(activeIndex) : undefined

  useEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  function move(step: number) {
    const next = flat[(activeIndex + step + flat.length) % flat.length]
    if (next) setActiveKey(next.key)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Bộ gõ đang ghép chữ (gõ tiếng Việt bằng IME): Enter/mũi tên thuộc về bộ gõ
    if (event.nativeEvent.isComposing) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      move(event.key === 'ArrowDown' ? 1 : -1)
    } else if (event.key === 'Enter' && active) {
      event.preventDefault()
      onOpenResult(active.href)
    }
  }

  const typed = query.trim() !== ''
  const message = 'px-5 py-6 text-body text-glass-dark-muted'
  let body: ReactNode
  if (!typed) {
    const scope = format.list(groups.map((group) => t(`search.scope.${group}`)))
    body = <p className={message}>{t('search.hint', { scope })}</p>
  } else if (sources.isPending) {
    body = <p className={message}>{t('search.loading')}</p>
  } else if (sources.isError) {
    body = (
      <div className="flex items-center justify-between gap-3 px-5 py-4">
        <p className="text-body text-glass-dark-muted">{t('search.error')}</p>
        <Button variant="secondary" onClick={() => void sources.refetch()}>{t('search.retry')}</Button>
      </div>
    )
  } else if (flat.length === 0) {
    body = <p className={message}>{t('search.noResults', { query: query.trim() })}</p>
  } else {
    body = (
      <SearchResults
        listId={listId}
        query={query}
        groups={resultGroups}
        activeIndex={activeIndex}
        indexOf={indexOf}
        optionId={optionId}
        onHover={setActiveKey}
        onOpen={(result) => onOpenResult(result.href)}
      />
    )
  }

  return (
    <>
      <div className="flex h-15 items-center gap-3 border-b border-glass-dark-border pr-4 pl-4.5">
        <Search className="size-5 flex-none text-cyan-200" strokeWidth={1.5} aria-hidden />
        <input
          role="combobox"
          aria-label={t('search.inputLabel')}
          aria-expanded={flat.length > 0}
          aria-controls={flat.length > 0 ? listId : undefined}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          autoComplete="off"
          spellCheck={false}
          placeholder={t('search.placeholder')}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveKey(null)
            if (listRef.current) listRef.current.scrollTop = 0
          }}
          onKeyDown={handleKeyDown}
          className="h-full min-w-0 flex-1 bg-transparent text-body-lg font-medium text-sky-text caret-cyan-300 outline-none placeholder:text-glass-dark-muted"
        />
        <p role="status" className="flex-none text-small whitespace-nowrap text-glass-dark-muted">
          {typed && sources.data ? t('search.count', { count: flat.length }) : ''}
        </p>
        <SearchKbd>Esc</SearchKbd>
      </div>

      <div ref={listRef} className="max-h-[min(28rem,60vh)] min-h-20 overflow-y-auto">
        {body}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-glass-dark-border bg-cyan-950/35 px-4.5 py-2.75 text-fine text-glass-dark-muted">
        <KeyHint keys={['↑', '↓']} label={t('search.keys.move')} />
        <KeyHint keys={['Enter']} label={t('search.keys.open')} />
        <KeyHint keys={['Esc']} label={t('search.keys.close')} />
        <span className="ml-auto">{t('search.shortcut', { keys: SHORTCUT_KEYS })}</span>
      </div>
    </>
  )
}

function KeyHint({ keys, label }: { keys: readonly string[]; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {keys.map((key) => <SearchKbd key={key}>{key}</SearchKbd>)}
      {label}
    </span>
  )
}
