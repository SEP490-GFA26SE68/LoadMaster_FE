import { useEffect, useState } from 'react'

const QUERY = '(prefers-reduced-motion: reduce)'

/** Môi trường không có `matchMedia` (jsdom) coi như không giảm chuyển động. */
const hasMatchMedia = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function'

/**
 * Người dùng có bật "giảm chuyển động" ở hệ điều hành hay không.
 * Mọi hoạt ảnh dài hơn 200ms phải hỏi hook này trước khi chạy (AGENTS.md mục 8).
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => hasMatchMedia() && window.matchMedia(QUERY).matches)

  useEffect(() => {
    if (!hasMatchMedia()) return
    const media = window.matchMedia(QUERY)
    const onChange = () => setReduced(media.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return reduced
}
