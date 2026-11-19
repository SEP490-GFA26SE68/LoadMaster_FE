import { useEffect, useRef, useState } from 'react'

/** Phần mở đầu mà đầu trang dính "đặc lại" khi cuộn qua: khối tối của trang giới thiệu, không có thì phần đầu tiên của `<main>`. */
function heroOf(): Element | null {
  return document.querySelector('.landing-cinema') ?? document.querySelector('main')?.firstElementChild ?? null
}

/** Mục có phần đang cắt qua đường đọc (40 % chiều cao khung nhìn); cuộn tới cuối trang thì là phần cuối còn trên màn. */
function sectionInView(ids: readonly string[]): string | null {
  const line = window.innerHeight * 0.4
  const sections = ids.flatMap((id) => {
    const element = document.getElementById(id)
    return element ? [{ id, rect: element.getBoundingClientRect() }] : []
  })
  const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
  if (atEnd) {
    const last = sections.findLast(({ rect }) => rect.top < window.innerHeight && rect.bottom > 0)
    if (last) return last.id
  }
  return sections.find(({ rect }) => rect.top <= line && rect.bottom > line)?.id ?? null
}

/**
 * Trạng thái cuộn của đầu trang công khai, không đưa từng khung hình qua React:
 * - `data-scrolled` ghi thẳng lên `<header>` khi phần mở đầu đã cuộn khuất dưới đầu trang (CSS ở `public-header.css` làm nền đặc hơn và
 *   thêm đường kẻ đáy);
 * - `active`: neo của mục đang đọc (chỉ khi `spyIds` có phần tử) — chỉ đổi khi người xem sang phần khác, để đầu trang tô mục đó.
 *
 * Đọc vị trí trong sự kiện `scroll` (trình duyệt phát mỗi khung hình một lần) và `resize`; không hẹn giờ, không đọc lại khi không cuộn.
 */
export function useHeaderScroll(spyIds: readonly string[]) {
  const ref = useRef<HTMLElement>(null)
  const [active, setActive] = useState<string | null>(null)
  const spyKey = spyIds.join(' ')

  useEffect(() => {
    const header = ref.current
    if (header === null) return
    const ids = spyKey === '' ? [] : spyKey.split(' ')
    let scrolled: boolean | null = null
    let current: string | null = null

    function update() {
      if (header === null) return
      const hero = heroOf()
      const past = window.scrollY > 0 && (hero === null || hero.getBoundingClientRect().bottom <= header.getBoundingClientRect().bottom + 1)
      if (past !== scrolled) {
        scrolled = past
        header.toggleAttribute('data-scrolled', past)
      }
      const next = ids.length > 0 ? sectionInView(ids) : null
      if (next !== current) {
        current = next
        setActive(next)
      }
    }

    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [spyKey])

  return { ref, active }
}
