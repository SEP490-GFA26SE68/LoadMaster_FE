import { useEffect } from 'react'
import { useLocation } from 'react-router'

/** Mã phần tử của neo (`#lien-he` → `lien-he`); neo trống hoặc mã hoá hỏng (`#%`) là không có neo, không ném lỗi. */
function anchorId(hash: string): string | null {
  if (hash.length <= 1) return null
  try {
    return decodeURIComponent(hash.slice(1))
  } catch {
    return null
  }
}

/**
 * Trang công khai cuộn cả tài liệu (không nằm trong khung ứng dụng). Mỗi lần điều hướng: có neo (`#lien-he`) thì cuộn tới phần đó —
 * liên kết từ Bảng giá sang form liên hệ — rồi đặt focus vào tiêu đề của phần (`tabIndex -1`), để bàn phím và trình đọc màn hình đi
 * tiếp từ đó thay vì từ đầu trang; không có neo thì về đầu trang, vì trình duyệt giữ chỗ cuộn của trang trước khi đổi route.
 */
export function useHashScroll() {
  const { hash, key } = useLocation()
  useEffect(() => {
    const id = anchorId(hash)
    const target = id === null ? null : document.getElementById(id)
    if (target === null) {
      if (window.scrollY > 0) window.scrollTo({ top: 0 })
      return
    }
    target.scrollIntoView({ block: 'start' })
    const heading = target.matches('h1, h2') ? target : target.querySelector<HTMLElement>('h2')
    heading?.focus({ preventScroll: true })
  }, [hash, key])
}
