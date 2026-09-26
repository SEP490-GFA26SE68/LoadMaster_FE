import { Package, Truck, UserRound, Warehouse, type LucideIcon } from 'lucide-react'
import { useId, type ReactNode } from 'react'
import { useT, type TFunction } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { highlightParts, type SearchGroup, type SearchResult, type SearchResultGroup } from './quick-search'
import { SearchKbd } from './SearchKbd'

/** Icon trùng mục nav của màn đích (chuyến: xe tải, đội xe: nhà kho, người dùng). */
const GROUP_ICONS: Readonly<Record<SearchGroup, LucideIcon>> = {
  trips: Truck,
  packages: Package,
  vehicles: Warehouse,
  users: UserRound,
}

/**
 * Danh sách kết quả của tìm nhanh (LM-099; V2.3 TimNhanh): listbox chia nhóm theo loại, mỗi nhóm có tiêu đề. Con trỏ nằm ở ô nhập
 * (`aria-activedescendant`), nên ở đây chỉ vẽ dòng đang chọn và nhận chuột; bàn phím do ô nhập xử lý. Phần chữ khớp từ khoá được tô
 * cyan — cùng luật tìm (bỏ dấu, mọi từ) nên người dùng thấy vì sao dòng hiện ra.
 */
export function SearchResults({ listId, query, groups, activeIndex, indexOf, optionId, onHover, onOpen }: {
  listId: string
  /** Từ khoá đang gõ, để tô phần khớp. */
  query: string
  groups: readonly SearchResultGroup[]
  activeIndex: number
  /** Vị trí của kết quả trong danh sách phẳng (thứ tự mũi tên). */
  indexOf: ReadonlyMap<string, number>
  optionId: (index: number) => string
  onHover: (key: string) => void
  onOpen: (result: SearchResult) => void
}) {
  const t = useT()
  return (
    <div role="listbox" id={listId} aria-label={t('search.results')} className="flex flex-col gap-0.5 px-2 pt-1.5 pb-2">
      {groups.map(({ group, results }) => (
        <ResultGroup key={group} group={group}>
          {results.map((result) => {
            const index = indexOf.get(result.key) ?? -1
            return (
              <ResultOption
                key={result.key}
                id={optionId(index)}
                query={query}
                result={result}
                active={index === activeIndex}
                onHover={() => onHover(result.key)}
                onOpen={() => onOpen(result)}
              />
            )
          })}
        </ResultGroup>
      ))}
    </div>
  )
}

function ResultGroup({ group, children }: { group: SearchGroup; children: ReactNode }) {
  const t = useT()
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col">
      <div id={labelId} className="px-3 pt-2.5 pb-1.5 text-caption leading-none font-semibold text-glass-dark-muted">
        {t(`search.groups.${group}`)}
      </div>
      {children}
    </div>
  )
}

function ResultOption({ id, query, result, active, onHover, onOpen }: {
  id: string
  query: string
  result: SearchResult
  active: boolean
  onHover: () => void
  onOpen: () => void
}) {
  const t = useT()
  const Icon = GROUP_ICONS[result.group]
  const mark = (text: string) => <Highlight text={text} query={query} />
  return (
    <div
      role="option"
      id={id}
      aria-selected={active}
      onMouseMove={active ? undefined : onHover}
      onClick={onOpen}
      className={cn(
        'flex min-h-13.5 cursor-pointer items-center gap-3 rounded-md px-3 py-2',
        active
          ? 'bg-cyan-400/20 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--cyan-300)_50%,transparent)]'
          : 'hover:bg-sky-glass',
      )}
    >
      <Icon className={cn('size-4.5 flex-none', active ? 'text-cyan-200' : 'text-glass-dark-muted')} strokeWidth={1.5} aria-hidden />
      <span className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="truncate text-body leading-5 font-semibold text-sky-text">{titleOf(result, mark)}</span>
        <span className="truncate text-small text-glass-dark-muted">{detailOf(result, mark, t)}</span>
      </span>
      {active ? (
        // Gợi ý phím cho dòng đang chọn; chân hộp thoại đã nói đủ cho trình đọc màn hình
        <span aria-hidden className="flex flex-none items-center gap-1.5 text-fine text-glass-dark-text">
          <SearchKbd>Enter</SearchKbd>
          {t('search.keys.open')}
        </span>
      ) : null}
    </div>
  )
}

const CODE = 'font-mono text-fine text-cyan-200'

function titleOf(result: SearchResult, mark: (text: string) => ReactNode): ReactNode {
  switch (result.group) {
    case 'trips':
    case 'users':
      return mark(result.name)
    case 'packages':
      return <span className="font-mono text-body font-medium">{mark(result.id)}</span>
    case 'vehicles': {
      // Tên xe gồm biển số ("Isuzu NQR 550 · 51C-284.19"): biển số là mã, chữ mono
      const cut = result.name.lastIndexOf(' · ')
      if (cut === -1) return mark(result.name)
      return (
        <>
          {mark(result.name.slice(0, cut + 3))}
          <span className="font-mono text-small font-medium">{mark(result.name.slice(cut + 3))}</span>
        </>
      )
    }
  }
}

function detailOf(result: SearchResult, mark: (text: string) => ReactNode, t: TFunction): ReactNode {
  switch (result.group) {
    case 'trips':
    case 'vehicles':
      return <span className={CODE}>{mark(result.id)}</span>
    case 'packages':
      return <><span className={CODE}>{result.tripId}</span> · {result.tripName}</>
    case 'users':
      return <><span className={CODE}>{mark(result.id)}</span> · {mark(result.email)} · {t(`roles.${result.role}`)}</>
  }
}

/** Chữ với phần khớp từ khoá bọc `<mark>` (nền cyan mờ, viền cyan nhạt, chữ trắng). */
function Highlight({ text, query }: { text: string; query: string }) {
  return highlightParts(text, query).map((part, index) =>
    part.match ? (
      <mark key={index} className="rounded-[3px] bg-cyan-400/20 text-sky-text shadow-[0_0_0_1px_color-mix(in_srgb,var(--cyan-300)_35%,transparent)]">
        {part.text}
      </mark>
    ) : (
      part.text
    ),
  )
}
