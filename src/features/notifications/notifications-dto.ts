import { roleOfBackend } from '@/features/auth/backend-user'
import { ApiError } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'
import type { ServerNotification, ServerNotificationFeed } from './server-notifications'

/**
 * DTO của `GET /api/notifications` và `POST /api/notifications/read` (`NotificationListResponse`) và phép đổi sang thông báo của app.
 * Chỉ `notifications-api.ts` import file này. Hàm thuần.
 */
export type NotificationDto = {
  /** Mã dòng nhật ký của máy chủ. */
  readonly id: number
  readonly actionType: string | null
  readonly entityName: string | null
  readonly entityId: string | null
  readonly tripId: number | null
  readonly tripCode: string | null
  readonly actorId: number | null
  /** `null`: việc của hệ thống. */
  readonly actorName: string | null
  readonly actorRole: string | null
  readonly oldValues: Readonly<Record<string, unknown>> | null
  readonly newValues: Readonly<Record<string, unknown>> | null
  readonly createdAt: string | null
  readonly read: boolean
}

export type NotificationListDto = {
  readonly items?: readonly NotificationDto[] | null
  readonly unreadCount?: number
  readonly windowDays?: number
}

function scalars(values: Readonly<Record<string, unknown>> | null): Readonly<Record<string, string | number | boolean>> {
  const out: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(values ?? {})) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[key] = value
  }
  return out
}

function notificationOf(dto: NotificationDto): ServerNotification {
  if (dto.createdAt === null) throw new ApiError('SERVER_ERROR')
  return {
    id: String(dto.id),
    at: isoFromBackend(dto.createdAt),
    actionType: dto.actionType ?? '',
    entityName: dto.entityName,
    entityId: dto.entityId,
    entityCode: dto.tripCode,
    tripId: dto.tripId === null ? null : String(dto.tripId),
    actorId: dto.actorId === null ? null : String(dto.actorId),
    actorName: dto.actorName,
    actorRole: dto.actorRole === null ? null : roleOfBackend(dto.actorRole),
    // Chuông không hiện công ty: người xem chỉ nhận việc của công ty mình (quản trị hệ thống: việc trên tài khoản)
    companyName: null,
    before: scalars(dto.oldValues),
    after: scalars(dto.newValues),
    read: dto.read,
  }
}

/** `viewerId`: mã người đang đăng nhập ở máy chủ — câu của tài xế phân biệt "được giao" và "bị thay" theo mã đó. */
export function notificationFeedOf(dto: NotificationListDto | null, viewerId: string | null): ServerNotificationFeed {
  return { items: (dto?.items ?? []).map(notificationOf), windowDays: dto?.windowDays ?? 7, viewerId }
}
