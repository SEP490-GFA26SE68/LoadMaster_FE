import { ApiError } from './api-client'

/**
 * Mốc giờ backend trả → ISO 8601 của app (`toISOString()`: mili giây, `Z`). Backend có hai dạng: `Instant` kèm `Z` và tới 9 chữ số lẻ
 * của giây (`2026-10-16T21:29:43.054948900Z`), và `LocalDateTime` không múi giờ (`2026-10-16T18:05:00`, có khi thiếu giây) — giờ của
 * máy chủ, đặt `Asia/Ho_Chi_Minh`, nên đọc là `+07:00` thay vì để trình duyệt đoán theo múi giờ của máy. Dạng khác là lỗi của máy chủ.
 */
const BACKEND_TIME = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/

const SERVER_OFFSET = '+07:00'

export function isoFromBackend(value: string): string {
  const match = BACKEND_TIME.exec(value.trim())
  if (match === null) throw new ApiError('SERVER_ERROR')
  const [, minutes = '', seconds = '00', fraction = '', offset = SERVER_OFFSET] = match
  const date = new Date(`${minutes}:${seconds}.${fraction.padEnd(3, '0').slice(0, 3)}${offset}`)
  if (Number.isNaN(date.getTime())) throw new ApiError('SERVER_ERROR')
  return date.toISOString()
}
