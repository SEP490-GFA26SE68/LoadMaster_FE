import { roleOfBackend } from '@/features/auth/backend-user'
import { ApiError } from '@/lib/api-client'
import { isoFromBackend } from '@/lib/backend-time'
import type { Role } from '@/types/user'

/**
 * DTO của `GET /api/audit-logs` (`PageResponse<AuditLogResponse>`: `data` là mảng, số trang ở cùng cấp, `page` đếm từ 0) và phép đổi
 * sang dòng nhật ký của app. Chỉ `audit-backend-api.ts` import file này. Hàm thuần.
 */
export type AuditLogDto = {
  readonly id: number
  readonly actionType: string | null
  readonly entityName: string | null
  readonly entityId: string | null
  readonly userId: number | null
  readonly userName: string | null
  readonly userRole: string | null
  readonly companyId: number | null
  readonly companyName: string | null
  readonly oldValues: Readonly<Record<string, unknown>> | null
  readonly newValues: Readonly<Record<string, unknown>> | null
  readonly ipAddress?: string | null
  readonly createdAt: string | null
}

export type AuditLogPageDto = {
  readonly data?: readonly AuditLogDto[] | null
  readonly page?: number
  readonly size?: number
  readonly totalElements?: number
  readonly totalPages?: number
  readonly last?: boolean
}

/** Giá trị trước / sau của một bản ghi: chỉ giữ giá trị đơn (chuỗi, số, đúng sai); mảng và đối tượng lồng nhau không hiện ra màn. */
export type AuditValues = Readonly<Record<string, string | number | boolean>>

/** Một dòng nhật ký của máy chủ. Mã hành động và tên đối tượng giữ nguyên mã của máy chủ; màn dịch, mã lạ hiện nguyên mã. */
export type ServerAuditEntry = {
  readonly id: string
  /** ISO 8601 (`toISOString()`). */
  readonly at: string
  readonly actionType: string
  readonly entityName: string | null
  readonly entityId: string | null
  /** `null`: hệ thống tự ghi (không có người làm). */
  readonly actorId: string | null
  readonly actorName: string | null
  /** Vai trò của người làm theo mã của app; `null` khi máy chủ không trả hoặc mã lạ. */
  readonly actorRole: Role | null
  /** `null`: bản ghi không thuộc công ty nào (nền tảng). */
  readonly companyName: string | null
  readonly before: AuditValues
  readonly after: AuditValues
}

export type ServerAuditPage = {
  readonly entries: readonly ServerAuditEntry[]
  /** Tổng số bản ghi khớp bộ lọc ở máy chủ, mọi trang. */
  readonly total: number
}

function scalars(values: Readonly<Record<string, unknown>> | null): AuditValues {
  const out: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(values ?? {})) {
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') out[key] = value
  }
  return out
}

export function auditEntryOf(dto: AuditLogDto): ServerAuditEntry {
  if (dto.createdAt === null) throw new ApiError('SERVER_ERROR')
  return {
    id: String(dto.id),
    at: isoFromBackend(dto.createdAt),
    actionType: dto.actionType ?? '',
    entityName: dto.entityName,
    entityId: dto.entityId,
    actorId: dto.userId === null ? null : String(dto.userId),
    actorName: dto.userName,
    actorRole: dto.userRole === null ? null : roleOfBackend(dto.userRole),
    companyName: dto.companyName,
    before: scalars(dto.oldValues),
    after: scalars(dto.newValues),
  }
}

export function auditPageOf(dto: AuditLogPageDto | null): ServerAuditPage {
  const entries = (dto?.data ?? []).map(auditEntryOf)
  return { entries, total: dto?.totalElements ?? entries.length }
}
