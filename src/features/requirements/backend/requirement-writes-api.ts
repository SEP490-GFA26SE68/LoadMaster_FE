import { api } from '@/lib/api-client'
import type { DeliveryRequirement, RequirementChanges, RequirementInput } from '@/lib/mock-db'
import { requirementFromApi, serverId, toVietnamLocalDateTime, type DeliveryRequirementApi } from './requirement-dto'

/**
 * Ghi yêu cầu giao vào máy chủ (điều phối viên, `DELIVERY_DEMAND_MANAGE`). Mã trong đường dẫn là mã số của máy chủ.
 *
 * | Hàm                            | Endpoint                                                    |
 * |--------------------------------|-------------------------------------------------------------|
 * | createDeliveryRequirement      | POST /api/delivery-requirements                              |
 * | updateDeliveryRequirement      | PATCH /api/delivery-requirements/{id}                        |
 * | updateRequirementSchedule      | PATCH /api/delivery-requirements/{id}                        |
 * | updateRequirementCoordinates   | PATCH /api/delivery-requirements/{id}/coordinates            |
 * | extendRequirementDeadline      | PATCH /api/delivery-requirements/{id}/extend-deadline        |
 * | deleteDeliveryRequirement      | DELETE /api/delivery-requirements/{id}                       |
 * | unassignRequirementFromTrip    | DELETE /api/trips/{tripId}/delivery-requirements/{requirementId} |
 */

const path = (id: string) => `/api/delivery-requirements/${serverId(id)}`

const read = (dto: DeliveryRequirementApi) => requirementFromApi(dto)

// POST /api/delivery-requirements
export async function createDeliveryRequirement(input: RequirementInput): Promise<DeliveryRequirement> {
  const customerId = serverId(input.customerId ?? '')
  const expectedPackageCount = input.expectedPackageCount
  if (expectedPackageCount === undefined || !Number.isSafeInteger(expectedPackageCount) || expectedPackageCount < 1) {
    throw new Error('Số kiện dự kiến phải là số nguyên dương')
  }
  const body = {
    customerId,
    destination: input.address.trim(),
    destinationLat: input.lat ?? null,
    destinationLng: input.lng ?? null,
    deadline: toVietnamLocalDateTime(input.deadline),
    priority: input.priority,
    expectedPackageCount,
    note: input.note?.trim() || null,
    packageIds: input.packageIds.map(serverId),
  }
  return read(await api().post<DeliveryRequirementApi>('/api/delivery-requirements', { body }))
}

/**
 * Sửa yêu cầu còn chờ xếp chuyến: chỉ gửi trường có giá trị (máy chủ bỏ qua trường vắng). `packageIds` có mặt là thay cả tập kiện của
 * yêu cầu (rỗng là bỏ hết, kiện quay về kho kiện).
 */
// PATCH /api/delivery-requirements/{id}
export async function updateDeliveryRequirement(id: string, changes: RequirementChanges): Promise<DeliveryRequirement> {
  const customerId = changes.customerId === undefined || changes.customerId === '' ? undefined : serverId(changes.customerId)
  const body = {
    ...(customerId === undefined ? {} : { customerId }),
    ...(changes.address === undefined ? {} : { destination: changes.address.trim() }),
    ...(typeof changes.lat === 'number' && typeof changes.lng === 'number' ? { destinationLat: changes.lat, destinationLng: changes.lng } : {}),
    ...(changes.deadline === undefined ? {} : { deadline: toVietnamLocalDateTime(changes.deadline) }),
    ...(changes.priority === undefined ? {} : { priority: changes.priority }),
    ...(changes.expectedPackageCount === undefined ? {} : { expectedPackageCount: changes.expectedPackageCount }),
    ...(changes.note === undefined ? {} : { note: changes.note.trim() }),
    ...(changes.packageIds === undefined ? {} : { packageIds: changes.packageIds.map(serverId) }),
  }
  return read(await api().patch<DeliveryRequirementApi>(path(id), { body }))
}

export type UpdateRequirementScheduleInput = { deadline?: string; priority?: string }

/** Yêu cầu đã vào chuyến còn Nháp / Đã lập kế hoạch: chỉ hạn (giờ Việt Nam, không múi giờ) và ưu tiên. */
// PATCH /api/delivery-requirements/{id}
export async function updateRequirementSchedule(id: string, input: UpdateRequirementScheduleInput): Promise<DeliveryRequirement> {
  return read(await api().patch<DeliveryRequirementApi>(path(id), { body: input }))
}

export type RequirementCoordinatesInput = { destinationLat: number; destinationLng: number }

/** Bổ sung toạ độ còn thiếu; toạ độ đã có không đổi được. */
// PATCH /api/delivery-requirements/{id}/coordinates
export async function updateRequirementCoordinates(id: string, input: RequirementCoordinatesInput): Promise<DeliveryRequirement> {
  return read(await api().patch<DeliveryRequirementApi>(`${path(id)}/coordinates`, { body: input }))
}

export type ExtendRequirementDeadlineInput = { newDeadline: string; reason: string }

/** Gia hạn khi chuyến đang vận chuyển; `newDeadline` là giờ Việt Nam không múi giờ. */
// PATCH /api/delivery-requirements/{id}/extend-deadline
export async function extendRequirementDeadline(id: string, input: ExtendRequirementDeadlineInput): Promise<DeliveryRequirement> {
  return read(await api().patch<DeliveryRequirementApi>(`${path(id)}/extend-deadline`, { body: input }))
}

/** Chỉ yêu cầu còn chờ, chưa vào chuyến và chưa giữ kiện nào; máy chủ từ chối `DELIVERY_REQUIREMENT_NOT_PENDING`. */
// DELETE /api/delivery-requirements/{id}
export async function deleteDeliveryRequirement(id: string): Promise<void> {
  await api().delete<unknown>(path(id))
}

/** `tripId` là mã số chuyến của máy chủ (`DeliveryRequirement.tripId`). */
export type UnassignRequirementInput = { readonly requirementId: string; readonly tripId: string }

/**
 * Gỡ yêu cầu khỏi chuyến Nháp / Đã lập kế hoạch: yêu cầu và kiện về chờ xử lý, điểm giao của yêu cầu bị xoá, tuyến bỏ (chuyến về Nháp),
 * phương án lỗi thời. Chuyến đã sang pha vận hành: `TRIP_NOT_EDITABLE`.
 */
// DELETE /api/trips/{tripId}/delivery-requirements/{requirementId}
export async function unassignRequirementFromTrip({ requirementId, tripId }: UnassignRequirementInput): Promise<void> {
  await api().delete<unknown>(`/api/trips/${serverId(tripId)}/delivery-requirements/${serverId(requirementId)}`)
}
