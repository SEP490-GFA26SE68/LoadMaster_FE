import type { Formatter } from '@/lib/format'
import type { TFunction } from '@/lib/i18n'

/** Mốc đổi sang giây: từ 1.000 ms trở lên đọc theo giây ("60,0 giây"), dưới đó giữ ms ("850 ms"). */
export const SECONDS_FROM_MS = 1000

/** Thời gian tính của máy chủ viết dễ đọc. Thuần. */
export function computationTime(ms: number, t: TFunction, format: Formatter): string {
  return ms >= SECONDS_FROM_MS
    ? t('serverRun.time.seconds', { seconds: format.decimal(ms / 1000) })
    : t('serverRun.time.ms', { ms: format.integer(ms) })
}
