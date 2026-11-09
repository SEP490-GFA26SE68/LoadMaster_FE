/**
 * Hàm → endpoint backend của tài xế ở điểm đang giao, ngoài lệnh dỡ (phần của `createDriverBackend` dùng chung mã tài xế và điểm đã đọc):
 *   reportIssue    → POST /api/driver/packages/{id}/issues
 *   manualUnload   → POST /api/driver/packages/{id}/manual-unload
 *   fetchLoadPlan  → GET /api/driver/trips/{id}/load-plan
 *   fetchStopTimes → GET /api/driver/trips/{id}/stops
 */
import { ApiError, isApiError, type ApiClient } from '@/lib/api-client'
import type { CurrentStopDto } from './driver-dto'
import { loadedPlanOf, tripStopsOf, type DeliveryIssueDto, type DriverLoadPlanDto, type DriverTripStopsDto, type ManualConfirmationDto } from './driver-delivery-dto'
import type { DriverLoadedPlan } from './driver-server-scene'
import type { ServerTripStops } from './server-stop-timing'

/** Sự cố theo kiện ở điểm `stopNumber`; `packageInstanceId` là mã kiện của máy chủ (`String(packageId)`). */
export type BackendIssueInput = {
  readonly stopNumber: number
  readonly packageInstanceId?: string
  readonly kind: 'damaged' | 'missing' | 'refused' | 'other'
  readonly note: string
}

/** Xác nhận tay một kiện khi dỡ (nhãn không đọc được): lý do bắt buộc, ghi chú bắt buộc khi lý do là "Khác". */
export type BackendManualInput = { readonly packageInstanceId: string; readonly reason: string; readonly note?: string }

type Deps = {
  readonly client: () => ApiClient
  /** Đợi mã tài xế: không lệnh nào gọi backend khi chưa biết đó là ai. */
  readonly ready: () => Promise<void>
  /** Điểm hiện tại của chuyến khi nó đúng là điểm `stopNumber` trên màn. */
  readonly stopOf: (tripId: string, stopNumber: number) => Promise<CurrentStopDto>
  /** Bỏ điểm đã đọc của chuyến: lần gõ mã kế tiếp đọc lại tiến độ mới. */
  readonly forget: (tripId: string) => void
}

export function createDeliveryBackend({ client, ready, stopOf, forget }: Deps) {
  /** Kiện `packageInstanceId` của điểm `stopNumber` (điểm hiện tại); không phải kiện của điểm thì không hỏi máy chủ. */
  async function stopPackage(tripId: string, stopNumber: number, packageInstanceId: string | undefined) {
    const dto = await stopOf(tripId, stopNumber)
    const pkg = (dto.packages ?? []).find((entry) => entry.packageId !== null && String(entry.packageId) === packageInstanceId)
    if (pkg?.packageId === null || pkg?.packageId === undefined) throw new ApiError('UNLOAD_CODE_UNMATCHED', { params: { code: packageInstanceId ?? '' } })
    return { packageId: pkg.packageId, label: pkg.trackingBarcode?.trim() || String(pkg.packageId) }
  }

  // POST /api/driver/packages/{id}/issues
  /** Sự cố theo kiện ở điểm đang giao; khách từ chối thì máy chủ bỏ dấu đã dỡ — kiện ở lại xe, hoàn trả khi hoàn tất điểm. */
  async function reportIssue(tripId: string, issue: BackendIssueInput): Promise<void> {
    await ready()
    const { packageId } = await stopPackage(tripId, issue.stopNumber, issue.packageInstanceId)
    await client().post<DeliveryIssueDto>(`/api/driver/packages/${packageId}/issues`, { body: { kind: issue.kind.toUpperCase(), note: issue.note } })
    forget(tripId)
  }

  // POST /api/driver/packages/{id}/manual-unload
  /** Xác nhận tay: máy chủ ghi kiện đã dỡ kèm xác nhận chờ điều phối viên duyệt; còn chờ thì chưa hoàn tất điểm được. */
  async function manualUnload(tripId: string, stopNumber: number, input: BackendManualInput): Promise<{ readonly packageInstanceId: string }> {
    await ready()
    const { packageId, label } = await stopPackage(tripId, stopNumber, input.packageInstanceId)
    try {
      await client().post<ManualConfirmationDto>(`/api/driver/packages/${packageId}/manual-unload`, { body: { reason: input.reason, note: input.note ?? null } })
    } catch (error) {
      // Hai lỗi dỡ có câu riêng nêu mã kiện
      if (isApiError(error) && (error.code === 'DUPLICATE_UNLOAD' || error.code === 'WRONG_DELIVERY_STOP')) {
        throw new ApiError(error.code, { status: error.status, params: { code: label } })
      }
      throw error
    }
    forget(tripId)
    return { packageInstanceId: String(packageId) }
  }

  // GET /api/driver/trips/{id}/load-plan
  async function fetchLoadPlan(tripId: string): Promise<DriverLoadedPlan> {
    await ready()
    return loadedPlanOf(await client().get<DriverLoadPlanDto>(`/api/driver/trips/${encodeURIComponent(tripId)}/load-plan`))
  }

  // GET /api/driver/trips/{id}/stops
  async function fetchStopTimes(tripId: string): Promise<ServerTripStops> {
    await ready()
    return tripStopsOf(await client().get<DriverTripStopsDto>(`/api/driver/trips/${encodeURIComponent(tripId)}/stops`))
  }

  return { reportIssue, manualUnload, fetchLoadPlan, fetchStopTimes }
}
