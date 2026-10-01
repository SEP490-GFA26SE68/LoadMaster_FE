import type { ColumnSort, SortingState } from '@tanstack/react-table'
import { useEffect, useMemo, useRef } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { DEFAULT_PAGE_SIZE, PAGE_SIZES } from './DataTablePagination'

/**
 * Tham số URL chung của màn danh sách, tiếng Việt không dấu (D-52). Tên bộ lọc của màn không được trùng các tên này.
 * Ví dụ: `?q=bien+hoa&trang-thai=da-lap-ke-hoach&sap-xep=-scheduledDate&trang=2&so-dong=50`.
 * - `sap-xep`: mã cột, thêm `-` phía trước là giảm dần; vắng là `defaultSort`.
 * - `trang`: đếm từ 1; vắng là trang 1. `so-dong`: 25/50/100; vắng là cỡ mặc định của màn (`defaultPageSize`, thường 25).
 */
export const LIST_URL_PARAMS = { query: 'q', sort: 'sap-xep', page: 'trang', pageSize: 'so-dong' } as const

export type ListUrlStateOptions<TFilter extends string> = {
  /** Tên tham số lọc của màn trên URL, ví dụ `['trang-thai', 'xe', 'tu', 'den']`. Giá trị vắng là chuỗi rỗng. */
  filters?: readonly TFilter[]
  /** Thứ tự khi URL chưa có `sap-xep`, ví dụ mới nhất trước `{ id: 'scheduledDate', desc: true }`. */
  defaultSort?: ColumnSort
  /** Cỡ trang khi URL chưa có `so-dong` — một trong `PAGE_SIZES`; vắng là 25. Nhật ký dày dùng 50 (LM-100). */
  defaultPageSize?: number
}

export type ListUrlState<TFilter extends string> = {
  /** Chữ tìm như người dùng gõ (chưa bỏ dấu). Ô nhập dùng `FilterBar`: nó giữ chữ đang gõ tại chỗ vì router đổi URL trong transition. */
  query: string
  setQuery: (query: string) => void
  /** Giá trị từng bộ lọc; `''` là không lọc. Giữ nguyên object khi URL không đổi, dùng được làm deps của `useMemo`. */
  filters: Readonly<Record<TFilter, string>>
  setFilter: (name: TFilter, value: string) => void
  /** Bỏ tìm và mọi bộ lọc, về trang 1; giữ thứ tự sắp xếp và cỡ trang. */
  clearAll: () => void
  sorting: SortingState
  setSorting: (sorting: SortingState) => void
  /** Trang đang xem, đếm từ 0. */
  pageIndex: number
  pageSize: number
  setPage: (pageIndex: number) => void
  setPageSize: (pageSize: number) => void
  /** Có tìm hoặc lọc: bảng rỗng lúc này là "không có kết quả khớp", không phải "chưa có dữ liệu". */
  isFiltering: boolean
}

const { query: Q, sort: SORT, page: PAGE, pageSize: PAGE_SIZE } = LIST_URL_PARAMS

/**
 * Trạng thái tìm, lọc, sắp xếp, trang của màn danh sách, giữ trên URL (D-52): tải lại hoặc quay lại từ trang chi tiết
 * vẫn đúng chỗ cũ. Mọi thay đổi ghi đè mục lịch sử hiện tại (`replace`) để nút Quay lại không phải lùi qua từng chữ gõ.
 * Đổi tìm, lọc, sắp xếp hay cỡ trang thì về trang 1.
 *
 * Router đổi URL trong transition: hai thay đổi liền nhau trước khi màn render lại (ví dụ đặt "từ" rồi "đến" trong một lần bấm)
 * mà cùng đọc tham số của lần render trước thì lần sau xoá mất lần trước. Vì vậy mỗi thay đổi tính trên bản nháp URL mới nhất
 * đã gửi (`draft`); URL đổi thật thì bỏ bản nháp.
 */
export function useListUrlState<const TFilter extends string = never>({
  filters: filterNames = [],
  defaultSort,
  defaultPageSize = DEFAULT_PAGE_SIZE,
}: ListUrlStateOptions<TFilter> = {}): ListUrlState<TFilter> {
  const [params, setParams] = useSearchParams()
  const { search } = useLocation()
  const draft = useRef<{ readonly from: string; readonly next: URLSearchParams } | null>(null)
  useEffect(() => {
    draft.current = null
  }, [search])

  const rawSort = params.get(SORT)
  const defaultId = defaultSort?.id
  const defaultDesc = defaultSort?.desc
  // Mảng mới mỗi lần render làm TanStack Table coi như đổi thứ tự và sắp lại: chỉ dựng lại khi URL đổi.
  const sorting = useMemo(
    () => parseSort(rawSort, defaultId === undefined ? undefined : { id: defaultId, desc: defaultDesc ?? false }),
    [rawSort, defaultId, defaultDesc],
  )

  const query = params.get(Q) ?? ''
  // Màn hay truyền mảng tên viết tại chỗ (mới mỗi lần render): so bằng chuỗi ghép để `filters` chỉ đổi khi URL đổi.
  const filterKey = filterNames.join('\n')
  const filters = useMemo(() => {
    const names = filterKey === '' ? [] : filterKey.split('\n')
    return Object.fromEntries(names.map((name) => [name, params.get(name) ?? ''])) as Record<TFilter, string>
  }, [params, filterKey])

  function update(change: (next: URLSearchParams) => void) {
    const pending = draft.current
    const next = new URLSearchParams(pending !== null && pending.from === search ? pending.next : params)
    change(next)
    draft.current = { from: search, next }
    setParams(next, { replace: true })
  }

  return {
    query,
    setQuery: (value) => update((next) => {
      setOrDelete(next, Q, value)
      next.delete(PAGE)
    }),
    filters,
    setFilter: (name, value) => update((next) => {
      setOrDelete(next, name, value)
      next.delete(PAGE)
    }),
    clearAll: () => update((next) => {
      for (const name of [Q, PAGE, ...filterNames]) next.delete(name)
    }),
    sorting,
    setSorting: (value) => update((next) => {
      setOrDelete(next, SORT, serializeSort(value, defaultSort))
      next.delete(PAGE)
    }),
    pageIndex: parsePageIndex(params.get(PAGE)),
    pageSize: parsePageSize(params.get(PAGE_SIZE), defaultPageSize),
    setPage: (pageIndex) => update((next) => setOrDelete(next, PAGE, pageIndex > 0 ? String(pageIndex + 1) : '')),
    setPageSize: (pageSize) => update((next) => {
      setOrDelete(next, PAGE_SIZE, pageSize === defaultPageSize ? '' : String(pageSize))
      next.delete(PAGE)
    }),
    isFiltering: query.trim() !== '' || filterNames.some((name) => filters[name] !== ''),
  }
}

function setOrDelete(params: URLSearchParams, name: string, value: string) {
  if (value === '') params.delete(name)
  else params.set(name, value)
}

function parseSort(raw: string | null, fallback: ColumnSort | undefined): SortingState {
  const desc = raw?.startsWith('-') ?? false
  const id = desc ? raw?.slice(1) : raw
  if (id) return [{ id, desc }]
  return fallback ? [fallback] : []
}

/** Thứ tự trùng `defaultSort` thì bỏ khỏi URL cho gọn. Chỉ ghi cột đầu: bảng tắt sắp xếp nhiều cột. */
function serializeSort(sorting: SortingState, fallback: ColumnSort | undefined): string {
  const [first] = sorting
  if (!first) return ''
  if (fallback && first.id === fallback.id && first.desc === fallback.desc) return ''
  return `${first.desc ? '-' : ''}${first.id}`
}

function parsePageIndex(raw: string | null): number {
  const page = Number(raw)
  return Number.isInteger(page) && page >= 1 ? page - 1 : 0
}

function parsePageSize(raw: string | null, fallback: number): number {
  const size = Number(raw)
  return PAGE_SIZES.some((allowed) => allowed === size) ? size : fallback
}
