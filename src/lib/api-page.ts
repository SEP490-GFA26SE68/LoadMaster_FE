import { api, ApiError, type ApiClient, type QueryValue } from './api-client'

export type FetchAllPagesOptions = {
  readonly query?: Readonly<Record<string, QueryValue>>
  readonly size?: number
  readonly maxPages?: number
  /** Only for a verified unpaged endpoint. Paged callers must not accept lost pagination metadata. */
  readonly allowUnpaged?: boolean
}

type Page<T> = { rows: T[]; last: boolean; totalPages?: number; totalElements?: number }

/** Complete dataset only. Plain arrays require allowUnpaged=true; paged responses
 * must prove termination. Limits/errors never return accumulated rows as a success. */
export async function fetchAllPages<T>(
  path: string,
  { query = {}, size = 200, maxPages = 50, allowUnpaged = false }: FetchAllPagesOptions = {},
  client: ApiClient = api(),
): Promise<T[]> {
  limits(size, maxPages)
  const items: T[] = []
  let totalPages: number | undefined
  let totalElements: number | undefined
  for (let page = 0; page < maxPages; page += 1) {
    const result = pageOf<T>(await client.getRaw(path, { query: { ...query, page, size } }), page, allowUnpaged)
    totalPages = consistent(totalPages, result.totalPages)
    totalElements = consistent(totalElements, result.totalElements)
    if (totalPages !== undefined && result.last !== (page + 1 >= totalPages)) invalid('last_conflicts_with_total_pages')
    items.push(...result.rows)
    checkCount(result, items.length, totalElements)
    if (result.last) return items
  }
  throw new ApiError('DATASET_INCOMPLETE', { params: { loadedCount: items.length, maxPages } })
}

/** Intentionally bounded preview, never advertised as a complete dataset.
 * Callers must use complete before concluding that an absent match does not exist. */
export async function fetchFirstPage<T>(
  path: string,
  { query = {}, size = 200, allowUnpaged = false }: Omit<FetchAllPagesOptions, 'maxPages'> = {},
  client: ApiClient = api(),
): Promise<{ rows: T[]; complete: boolean }> {
  limits(size, 1)
  const result = pageOf<T>(await client.getRaw(path, { query: { ...query, page: 0, size } }), 0, allowUnpaged)
  checkCount(result, result.rows.length, result.totalElements)
  return { rows: result.rows, complete: result.last }
}

function limits(size: number, maxPages: number): void {
  if (!Number.isSafeInteger(size) || size < 1 || !Number.isSafeInteger(maxPages) || maxPages < 1)
    throw new RangeError('size and maxPages must be positive safe integers')
}

function invalid(reason: string): never {
  throw new ApiError('INVALID_PAGE_RESPONSE', { params: { reason } })
}

function consistent(previous: number | undefined, next: number | undefined): number | undefined {
  if (previous !== undefined && next !== undefined && previous !== next) invalid('totals_changed')
  return next ?? previous
}

function checkCount<T>(page: Page<T>, loaded: number, total: number | undefined): void {
  if (!page.last && page.rows.length === 0) invalid('empty_intermediate_page')
  if (total !== undefined && (loaded > total || (page.last ? loaded !== total : loaded >= total)))
    invalid('total_elements_mismatch')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

const PAGING_KEYS = ['last', 'page', 'number', 'size', 'totalPages', 'totalElements', 'first', 'empty', 'numberOfElements']

function integer(meta: Record<string, unknown>, key: string): number | undefined {
  if (!(key in meta)) return undefined
  const value = meta[key]
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) invalid('invalid_' + key)
  return value
}

/** PageResponse, classic Spring Page, Spring's nested page block, or explicit unpaged array.
 * Missing data or paged termination metadata is a protocol error, never an empty list. */
function pageOf<T>(payload: unknown, expectedPage: number, allowUnpaged: boolean): Page<T> {
  if (Array.isArray(payload)) {
    if (!allowUnpaged) invalid('missing_pagination_metadata')
    if (expectedPage !== 0) invalid('paged_to_unpaged')
    return { rows: payload as T[], last: true }
  }
  if (!isRecord(payload)) invalid('missing_page_data')
  if ('success' in payload && typeof payload.success !== 'boolean') invalid('invalid_success')
  if (payload.success === false) throw new ApiError('SERVER_ERROR')
  const body = isRecord(payload.data) ? payload.data : payload
  const arrayData = Array.isArray(body.data)
  const rows: unknown = arrayData ? body.data : body.content
  if (!Array.isArray(rows)) invalid('missing_page_data')
  const paged = !arrayData || PAGING_KEYS.some(key => key in body)
  if (!paged) {
    if (!allowUnpaged) invalid('missing_pagination_metadata')
    if (expectedPage !== 0) invalid('paged_to_unpaged')
    return { rows: rows as T[], last: true }
  }

  if ('page' in body && !isRecord(body.page) && typeof body.page !== 'number') invalid('invalid_page')
  if (isRecord(body.page)) {
    for (const key of ['last', 'totalPages', 'totalElements', 'size', 'number']) {
      if (key in body && key in body.page && body[key] !== body.page[key]) invalid('conflicting_metadata')
    }
  }
  const meta = isRecord(body.page) ? { ...body, ...body.page } : body
  const index = integer(meta, 'number')
  const flatIndex = typeof body.page === 'number' ? integer(body, 'page') : undefined
  if ((index !== undefined && index !== expectedPage) || (flatIndex !== undefined && flatIndex !== expectedPage))
    invalid('unexpected_page_index')
  const totalPages = integer(meta, 'totalPages')
  const totalElements = integer(meta, 'totalElements')
  const size = integer(meta, 'size')
  if (size !== undefined && rows.length > size) invalid('rows_exceed_page_size')
  if (totalPages !== undefined) {
    if (totalPages === 0 ? expectedPage !== 0 || rows.length !== 0 : expectedPage >= totalPages)
      invalid('page_overflow')
  }
  if ('last' in meta && typeof meta.last !== 'boolean') invalid('invalid_last')
  const inferredLast = totalPages === undefined ? undefined : expectedPage + 1 >= totalPages
  const last = typeof meta.last === 'boolean' ? meta.last : inferredLast
  if (last === undefined) invalid('missing_termination_metadata')
  if (inferredLast !== undefined && inferredLast !== last) invalid('last_conflicts_with_total_pages')
  return {
    rows: rows as T[], last,
    ...(totalPages === undefined ? {} : { totalPages }),
    ...(totalElements === undefined ? {} : { totalElements }),
  }
}
