import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'
import type { AuditEvent } from '@/lib/mock-db'
import type { Role } from '@/types/user'
import { paramLabel, paramValue, type AuditDirectory, type AuditLogRow } from './audit-log'

/**
 * Sự kiện sửa đúng một giá trị (V2.3, quyết định 2) mang `before` và `after`: cột Chi tiết hiện chúng thành một chip "80 → 86" cạnh
 * tên trường thay cho "Trước: 80 · Sau: 86". Giá trị đã format theo ngôn ngữ, mã đã dịch; chữ người dùng nhập giữ nguyên.
 */
export type AuditChange = {
  /** Các tham số còn lại, đã dịch, nối bằng dấu chấm giữa; rỗng khi sự kiện chỉ có trước / sau. */
  readonly rest: string
  /** Tên trường đã sửa (tham số `field`) — vắng khi sự kiện không nói trường nào. */
  readonly field: string | null
  readonly before: string
  readonly after: string
}

/** Dòng của bảng `/nhat-ky` cộng những gì chỉ màn này vẽ: mã vai trò của người làm (nhãn có icon) và thay đổi trước → sau. */
export type AuditTableRow = AuditLogRow & {
  readonly actorRoleCode: Role | null
  readonly change: AuditChange | null
}

/** `null` khi sự kiện không mang cặp `before` + `after` — chi tiết vẫn là chuỗi `details` của `AuditRow`. Hàm thuần. */
export function describeChange(event: AuditEvent, directory: AuditDirectory, t: TFunction, format: Formatter): AuditChange | null {
  const { before, after, field } = event.params
  if (before === undefined || after === undefined) return null
  const value = (key: string, raw: string | number) => paramValue(event, key, raw, directory, t, format)
  return {
    rest: Object.entries(event.params)
      .filter(([key]) => key !== 'before' && key !== 'after' && key !== 'field')
      .map(([key, raw]) => t('audit.log.detail', { label: paramLabel(key, t), value: value(key, raw) }))
      .join(' · '),
    field: field === undefined ? null : value('field', field),
    before: value('before', before),
    after: value('after', after),
  }
}
