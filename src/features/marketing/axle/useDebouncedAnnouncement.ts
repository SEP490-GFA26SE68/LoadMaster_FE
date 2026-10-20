import { useEffect, useState } from 'react'

/** Người xem thôi kéo chừng này (ms) thì vùng `aria-live` mới đọc: kéo liên tục không làm trình đọc màn hình đọc từng bước. */
export const ANNOUNCE_DELAY_MS = 600

/**
 * Câu cho vùng `aria-live="polite"`: rỗng tới khi người xem thao tác lần đầu (`active`), sau đó là `text` mới nhất, đặt sau khi `text` đứng
 * yên `delayMs`. Đổi ngôn ngữ trước lần thao tác đầu không làm đọc gì.
 */
export function useDebouncedAnnouncement(text: string, active: boolean, delayMs = ANNOUNCE_DELAY_MS): string {
  const [said, setSaid] = useState('')
  useEffect(() => {
    if (!active) return undefined
    const timer = setTimeout(() => setSaid(text), delayMs)
    return () => clearTimeout(timer)
  }, [text, active, delayMs])
  return said
}
