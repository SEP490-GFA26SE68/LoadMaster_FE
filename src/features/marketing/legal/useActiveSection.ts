import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'

/** Dải đọc của khung nhìn: từ dưới đầu trang dính (96 px) tới gần giữa màn — mục chạm dải này là mục đang đọc. */
const READING_BAND = '-96px 0px -55% 0px'

/**
 * Mục đang đọc của trang pháp lý, để mục lục đánh dấu: mục đầu tiên (theo thứ tự trang) đang chạm dải đọc. Chưa cuộn tới mục nào thì là
 * mục của neo trên URL (vừa bấm ở mục lục hoặc mở liên kết sâu), không có neo thì chưa mục nào. Trình duyệt không có
 * `IntersectionObserver` chỉ còn theo neo. Một observer cho cả trang, gỡ khi rời trang.
 */
export function useActiveSection(ids: readonly string[]): string | null {
  const { hash } = useLocation()
  const [seen, setSeen] = useState<string | null>(null)
  const key = ids.join(' ')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const order = key.split(' ')
    const visible = new Set<string>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id)
          else visible.delete(entry.target.id)
        }
        const first = order.find((id) => visible.has(id))
        if (first !== undefined) setSeen(first)
      },
      { rootMargin: READING_BAND },
    )
    for (const id of order) {
      const section = document.getElementById(id)
      if (section) observer.observe(section)
    }
    return () => observer.disconnect()
  }, [key])

  if (seen !== null) return seen
  const anchor = hash.slice(1)
  return ids.includes(anchor) ? anchor : null
}
