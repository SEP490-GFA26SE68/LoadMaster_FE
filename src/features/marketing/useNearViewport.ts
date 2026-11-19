import { useEffect, useRef, useState, type RefObject } from 'react'

/**
 * `true` khi phần tử đã tới gần khung nhìn (mặc định cách 800 px) — một lần, không trở lại `false`. Trang giới thiệu dùng nó để chưa đọc
 * danh mục gói (dựng cả kho mẫu, hơn một giây việc trên luồng chính) khi khách còn ở phần mở đầu. Không có `IntersectionObserver` (jsdom,
 * trình duyệt cũ) thì coi như đã tới gần ngay, để trang vẫn đủ nội dung.
 */
export function useNearViewport<T extends Element>(rootMargin = '800px 0px'): [RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const element = ref.current
    if (near || element === null) return
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setNear(true)
    }, { rootMargin })
    observer.observe(element)
    return () => observer.disconnect()
  }, [near, rootMargin])
  return [ref, near]
}
