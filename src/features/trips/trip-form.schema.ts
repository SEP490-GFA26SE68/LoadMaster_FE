import { z } from 'zod'
import { coordinateText, EMPTY_COORDINATES, parseCoordinates } from '@/components/map'
import type { TFunction } from '@/lib/i18n'
import { DEFAULT_DEPARTURE_TIME, vnClock, vnTime, type CompanyDepot, type Trip } from '@/lib/mock-db'
import { todayInVietnam } from './trip-dates'

/** Giá trị "Chưa gán" của ô chọn tài xế: Radix Select không nhận `value=""` cho một dòng chọn được. */
export const UNASSIGNED = 'none'

/** Số điện thoại dạng hiển thị (`0901 234 567`, `+84 28 3775 1122`): chữ số, dấu cách, `+ - . ( )`. */
const PHONE = /^[0-9+().\s-]*$/

/**
 * Form khung chuyến (LM-053, LM-088, FE-4b-04): tên, ngày và giờ xuất phát, tài xế, xe, kho xuất phát (tên, địa chỉ, toạ độ) — đúng
 * các trường kho lưu (`Trip`). Điểm giao **không nhập ở đây khi tạo chuyến**: điểm tự sinh khi đưa yêu cầu giao vào chuyến, hoặc thêm
 * tay ở Chi tiết chuyến (D-73); form sửa chỉ đổi chữ của điểm giao hiện có (tên, địa chỉ, liên hệ). Kiện thêm ở Chi tiết chuyến. Câu
 * lỗi lấy từ từ điển nên schema dựng theo `t`.
 */
export function createTripFormSchema(t: TFunction) {
  const stop = z.object({
    name: z.string().trim().min(1, t('trips.create.stopNameRequired')).max(120, t('trips.create.tooLong')),
    address: z.string().trim().max(200, t('trips.create.tooLong')),
    phone: z.string().trim().max(20, t('trips.create.tooLong')).regex(PHONE, t('trips.create.phoneInvalid')),
    contactName: z.string().trim().max(120, t('trips.create.tooLong')),
  })
  const depot = z.object({
    name: z.string().trim().min(1, t('trips.create.depotNameRequired')).max(120, t('trips.create.tooLong')),
    address: z.string().trim().max(200, t('trips.create.tooLong')),
    coordinates: z.object({ lat: z.string(), lng: z.string() }),
  }).superRefine((value, ctx) => {
    // Kho xuất phát là điểm đầu của tuyến: bắt buộc có toạ độ. Lỗi của từng ô vĩ độ / kinh độ do ô chọn toạ độ tự hiện
    const point = parseCoordinates(value.coordinates.lat, value.coordinates.lng)
    if (point.kind !== 'ok') {
      ctx.addIssue({ code: 'custom', path: ['coordinates'], message: t(point.kind === 'empty' ? 'trips.create.depotCoordinatesRequired' : 'trips.create.depotCoordinatesInvalid') })
    }
  })
  return z.object({
    name: z.string().trim().min(1, t('trips.create.nameRequired')).max(120, t('trips.create.tooLong')),
    scheduledDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('trips.create.dateRequired')),
    departureTime: z.string().regex(/^\d{2}:\d{2}$/, t('trips.create.timeRequired')),
    vehicleId: z.string().min(1, t('trips.create.vehicleRequired')),
    driverId: z.string(),
    depot,
    stops: z.array(stop),
  })
}

export type TripFormValues = z.infer<ReturnType<typeof createTripFormSchema>>

export type DepotFormValues = TripFormValues['depot']

/** Kho xuất phát thành giá trị của form; chưa biết kho của công ty (đang tải) thì để trống. */
export function depotFormValues(depot: CompanyDepot | null | undefined): DepotFormValues {
  if (!depot) return { name: '', address: '', coordinates: EMPTY_COORDINATES }
  return { name: depot.name, address: depot.address, coordinates: coordinateText(depot.lat, depot.lng) }
}

/** Kho xuất phát ghi vào kho. Gọi sau khi schema đã qua: toạ độ chắc chắn đọc được. */
export function depotOf(values: DepotFormValues): CompanyDepot {
  const point = parseCoordinates(values.coordinates.lat, values.coordinates.lng)
  if (point.kind !== 'ok') throw new Error('Kho xuất phát chưa có toạ độ hợp lệ')
  return { name: values.name.trim(), address: values.address.trim(), lat: point.lat, lng: point.lng }
}

/** Giờ xuất phát ISO 8601 từ ngày + giờ nhập — theo **giờ Việt Nam**, như ngày chạy của chuyến (không theo múi giờ của máy). */
export function departureAtOf(values: Pick<TripFormValues, 'scheduledDate' | 'departureTime'>): string {
  return vnTime(values.scheduledDate, values.departureTime)
}

/**
 * Giá trị ban đầu: chuyến mới chạy hôm nay lúc `DEFAULT_DEPARTURE_TIME`, chưa gán tài xế, xuất phát từ kho của công ty (`depot`, điền
 * khi tải xong); sửa thì lấy từ chuyến.
 */
export function tripFormDefaults(existing?: Trip, depot?: CompanyDepot | null): TripFormValues {
  if (!existing) {
    return {
      name: '', scheduledDate: todayInVietnam(), departureTime: DEFAULT_DEPARTURE_TIME, vehicleId: '', driverId: UNASSIGNED,
      depot: depotFormValues(depot), stops: [],
    }
  }
  return {
    name: existing.name,
    scheduledDate: existing.scheduledDate,
    departureTime: vnClock(new Date(existing.departureAt)),
    vehicleId: existing.vehicleId,
    driverId: existing.driverId ?? UNASSIGNED,
    depot: depotFormValues(existing.depot),
    stops: existing.stops.map((stop) => ({ name: stop.name, address: stop.address, phone: stop.phone ?? '', contactName: stop.contactName ?? '' })),
  }
}

/** Mã tài xế ghi vào kho: "Chưa gán" là `null`. */
export function driverIdOf(value: string): string | null {
  return value === UNASSIGNED || value === '' ? null : value
}
