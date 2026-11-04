/**
 * Hàm → endpoint backend của danh sách và Chi tiết chuyến khi nhóm `trips` nối backend (`usesBackend('trips')`):
 *   listTrips  → GET /api/trips (đọc hết mọi trang, tối đa 100 dòng mỗi trang)
 *   tripDetail → GET /api/trips?search={mã chuyến} rồi GET /api/trips/{id}/detail
 */
import { api, ApiError } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import type { TripRow } from './trip-list'
import type { ServerTrip } from './server-trip'
import { serverTripOf, tripRowOf, type TripDetailDto, type TripDto } from './trips-dto'

/** Backend từ chối `size` trên 100. */
const PAGE_SIZE = 100

// GET /api/trips
export async function listTrips(): Promise<TripRow[]> {
  return (await fetchAllPages<TripDto>('/api/trips', { size: PAGE_SIZE })).map(tripRowOf)
}

/**
 * Chuyến theo mã chuyến (mã trên URL). `/detail` chỉ nhận mã số, nên tìm dòng có đúng mã chuyến trong danh sách trước — dòng đó còn
 * mang số kiện mà `/detail` không trả. Không có dòng nào khớp (mã của kho mẫu, mã gõ sai, chuyến của công ty khác) là
 * `TRIP_NOT_FOUND` mà không gọi `/detail`.
 */
// GET /api/trips?search={code} · GET /api/trips/{id}/detail
export async function tripDetail(tripCode: string): Promise<ServerTrip> {
  const wanted = tripCode.trim().toUpperCase()
  const rows = wanted === ''
    ? []
    : await fetchAllPages<TripDto>('/api/trips', { query: { search: tripCode.trim() }, size: PAGE_SIZE, maxPages: 1 })
  const listed = rows.find((row) => row.tripCode.toUpperCase() === wanted)
  if (!listed) throw new ApiError('TRIP_NOT_FOUND', { status: 404 })
  const detail = await api().get<TripDetailDto>(`/api/trips/${encodeURIComponent(String(listed.id))}/detail`)
  return serverTripOf(listed, detail)
}
