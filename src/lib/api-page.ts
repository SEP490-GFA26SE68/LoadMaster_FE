import { api, type ApiClient, type QueryValue } from './api-client'

/**
 * Đọc hết một danh sách phân trang của backend — màn của app tự lọc, sắp xếp và phân trang ở client như với kho mẫu. Backend trả ba
 * dạng: `PageResponse` (`{ success, data: T[], page, totalPages, last }`), phong bì bọc trang của Spring (`{ data: { content: T[],
 * last | page: { number, totalPages } } }`) và mảng (trần hoặc trong phong bì, không phân trang). Tham số trang là `page` (từ 0) và
 * `size`. Dừng ở trang cuối, hoặc sau `maxPages` trang để một backend lỗi không làm vòng lặp chạy mãi.
 */
export type FetchAllPagesOptions = {
  readonly query?: Readonly<Record<string, QueryValue>>
  readonly size?: number
  readonly maxPages?: number
}

export async function fetchAllPages<T>(
  path: string,
  { query = {}, size = 200, maxPages = 50 }: FetchAllPagesOptions = {},
  client: ApiClient = api(),
): Promise<T[]> {
  const items: T[] = []
  for (let page = 0; page < maxPages; page += 1) {
    const { rows, last } = pageOf<T>(await client.getRaw(path, { query: { ...query, page, size } }))
    items.push(...rows)
    if (last || rows.length === 0) return items
  }
  return items
}

type Page<T> = { readonly rows: T[]; readonly last: boolean }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Dạng trang của một phản hồi. Không có thông tin trang nào là danh sách không phân trang: đọc một lần là đủ. */
function pageOf<T>(payload: unknown): Page<T> {
  if (Array.isArray(payload)) return { rows: payload as T[], last: true }
  if (!isRecord(payload)) return { rows: [], last: true }
  const { data } = payload
  if (Array.isArray(data)) return { rows: data as T[], last: isLast(payload) }
  if (isRecord(data) && Array.isArray(data.content)) return { rows: data.content as T[], last: isLast(data) }
  if (Array.isArray(payload.content)) return { rows: payload.content as T[], last: isLast(payload) }
  return { rows: [], last: true }
}

function isLast(page: Record<string, unknown>): boolean {
  if (typeof page.last === 'boolean') return page.last
  const meta = isRecord(page.page) ? page.page : page
  const index = typeof meta.number === 'number' ? meta.number : meta.page
  if (typeof index === 'number' && typeof meta.totalPages === 'number') return index + 1 >= meta.totalPages
  return true
}
