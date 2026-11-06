import { ApiError } from './api-client'

/**
 * Mốc giờ backend trả → ISO 8601 của app (`toISOString()`: mili giây, `Z`). Backend có hai dạng: `Instant` kèm `Z` và tới 9 chữ số lẻ
 * của giây (`2026-10-16T21:29:43.054948900Z`), và `LocalDateTime` không múi giờ (`2026-10-16T18:05:00`, có khi thiếu giây) — giờ của
 * máy chủ, đặt `Asia/Ho_Chi_Minh`, nên đọc là `+07:00` thay vì để trình duyệt đoán theo múi giờ của máy. Trường có
 * `@JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")` ngăn ngày và giờ bằng dấu cách thay chữ `T`: cùng nghĩa. Dạng khác là lỗi của máy chủ.
 */
const BACKEND_TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(Z|[+-]\d{2}:\d{2})?$/

const SERVER_OFFSET = '+07:00'

export function isoFromBackend(value: string): string {
  const match = BACKEND_TIME.exec(value.trim())
  if (match === null) throw new ApiError('SERVER_ERROR')
  const [, day = '', minutes = '', seconds = '00', fraction = '', offset = SERVER_OFFSET] = match
  const date = new Date(`${day}T${minutes}:${seconds}.${fraction.padEnd(3, '0').slice(0, 3)}${offset}`)
  if (Number.isNaN(date.getTime())) throw new ApiError('SERVER_ERROR')
  return date.toISOString()
}

const VN_PARTS = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

/** Chiều ngược của `isoFromBackend`: ISO 8601 của app → `LocalDateTime` giờ Việt Nam (`2026-10-16T18:05:00`) cho thân lệnh gửi máy chủ. */
export function backendLocalDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) throw new ApiError('BAD_REQUEST')
  const parts = VN_PARTS.formatToParts(date)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`
}
