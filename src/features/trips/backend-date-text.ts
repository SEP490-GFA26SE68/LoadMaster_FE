import { isoFromBackend } from '@/lib/backend-time'
import type { Formatter } from '@/lib/format'

/** Mốc giờ của máy chủ ("2026-11-06T06:30:00") viết theo ngôn ngữ đang chọn: "06:30 · 06/11/2026". Vắng hoặc sai dạng là "—". */
export function backendDateTimeText(value: string | null | undefined, format: Formatter): string {
  if (value == null || value === '') return '—'
  try {
    const iso = isoFromBackend(value)
    return `${format.time(iso)} · ${format.date(iso)}`
  } catch {
    return '—'
  }
}
