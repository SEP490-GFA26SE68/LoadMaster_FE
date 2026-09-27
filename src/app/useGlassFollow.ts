import { useEffect, useRef } from 'react'

/**
 * Chỉ báo kính trượt theo con trỏ trong thanh điều hướng (V2, vật liệu kính cyan của V2.3 ở `.glass-follow`). Một thanh một chỉ báo:
 * bám mục đang hover hoặc đang focus, trả về mục đang mở khi con trỏ rời thanh hoặc
 * focus đi ra ngoài, neo lại khi thanh đổi kích thước.
 *
 * Chỉ nghe `pointerenter` và `focus` — không nghe `pointermove`, không vòng lặp frame.
 * Chuyển động chỉ bật sau khi đã đặt đúng chỗ ở frame đầu (`data-follow="ready"`), nếu
 * không lúc tải trang chỉ báo sẽ trượt từ mép trái vào mục đang mở.
 */
export function useGlassFollow<T extends HTMLElement>() {
  const navRef = useRef<T>(null)
  const followRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const nav = navRef.current
    const follow = followRef.current
    if (!nav || !follow) return

    /** Màn không nằm dưới mục nav nào (hồ sơ, 403) thì giấu chỉ báo thay vì neo tuỳ tiện. */
    const anchor = (link: HTMLElement | null) => {
      if (!link) {
        follow.hidden = true
        return
      }
      follow.hidden = false
      follow.style.transform = `translateY(${link.offsetTop}px)`
      follow.style.left = `${link.offsetLeft}px`
      follow.style.width = `${link.offsetWidth}px`
      follow.style.height = `${link.offsetHeight}px`
    }
    const current = () => nav.querySelector<HTMLElement>('[aria-current="page"]')
    const toActive = () => anchor(current())

    const links = [...nav.querySelectorAll<HTMLElement>('a')]
    const enter = (link: HTMLElement) => () => anchor(link)
    const handlers = links.map((link) => {
      const onEnter = enter(link)
      link.addEventListener('pointerenter', onEnter)
      link.addEventListener('focus', onEnter)
      return { link, onEnter }
    })
    const onLeave = () => toActive()
    const onFocusOut = (event: FocusEvent) => {
      if (!nav.contains(event.relatedTarget as Node | null)) toActive()
    }
    nav.addEventListener('pointerleave', onLeave)
    nav.addEventListener('focusout', onFocusOut)
    const observer = new ResizeObserver(toActive)
    observer.observe(nav)

    toActive()
    const frame = requestAnimationFrame(() => {
      nav.dataset.follow = 'ready'
    })

    return () => {
      for (const { link, onEnter } of handlers) {
        link.removeEventListener('pointerenter', onEnter)
        link.removeEventListener('focus', onEnter)
      }
      nav.removeEventListener('pointerleave', onLeave)
      nav.removeEventListener('focusout', onFocusOut)
      observer.disconnect()
      cancelAnimationFrame(frame)
      delete nav.dataset.follow
    }
  })

  return { navRef, followRef }
}
