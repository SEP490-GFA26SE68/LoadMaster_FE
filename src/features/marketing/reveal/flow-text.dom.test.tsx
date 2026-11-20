import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { installFakeIntersectionObserver, type FakeIntersectionObserverControl } from '@/test/intersection-observer'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { FlowHeading, LineRise, Reveal, RevealProvider, TextRibbon } from '.'

/**
 * Ba kiểu "chảy chữ" của trang giới thiệu: `FlowHeading` (từng grapheme), `LineRise` (từng dòng), `TextRibbon` (hàng chữ trôi theo cuộn).
 * Chuyển động tắt (jsdom không có IntersectionObserver, giảm chuyển động, ngoài provider): chữ thường, không bản sao. Bật: tên truy cập giữ
 * nguyên, bản trang trí `aria-hidden`.
 */
const TITLE = 'Tận dụng thùng xe, dỡ đúng thứ tự'
/** Khoảng trắng không ngắt (U+00A0). */
const NBSP = String.fromCharCode(0xa0)
const LINES = 'Hàng giao sau lên xe trước. Hàng giao trước nằm sát cửa. Tới điểm nào, lấy hàng điểm đó.'
const ROWS = [
  ['Xếp 3D theo thứ tự dỡ', 'Đối chiếu từng kiện bằng mã QR'],
  ['Nhận hàng dọc đường', 'Báo cáo sau mỗi chuyến'],
] as const

let io: FakeIntersectionObserverControl | null = null
let media: MatchMediaControl | null = null

function motionOn(reduce = false) {
  io = installFakeIntersectionObserver()
  media = installMatchMedia({ '(prefers-reduced-motion: reduce)': reduce })
  return io
}

afterEach(() => {
  cleanup()
  io?.restore()
  media?.restore()
  io = null
  media = null
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function renderPage(ui: ReactNode) {
  return render(
    <I18nProvider>
      <RevealProvider>{ui}</RevealProvider>
    </I18nProvider>,
  )
}

/** jsdom chưa có `AnimationEvent`: React DOM nghe cả tên có tiền tố. */
function finishAnimation(el: Element, animationName: string) {
  for (const type of ['animationend', 'webkitAnimationEnd']) {
    fireEvent(el, Object.assign(new Event(type, { bubbles: true }), { animationName }))
  }
}

describe('motion off', () => {
  test('FlowHeading and LineRise render plain text; LineRise keeps one block per sentence so turning motion on moves nothing', () => {
    renderPage(
      <>
        <FlowHeading as="h2" text={TITLE} before={<span className="sr-only">Bước 1: </span>} />
        <LineRise as="p" lines={LINES} renderLine={(line) => <b>{line}</b>} data-testid="cau" />
      </>,
    )
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.innerHTML).toBe(`<span class="sr-only">Bước 1: </span>${TITLE}`)
    const paragraph = screen.getByTestId('cau')
    expect(paragraph).toHaveTextContent(LINES)
    expect([...paragraph.querySelectorAll('.reveal-line')].map((line) => line.textContent)).toStrictEqual([
      'Hàng giao sau lên xe trước.',
      'Hàng giao trước nằm sát cửa.',
      'Tới điểm nào, lấy hàng điểm đó.',
    ])
    // renderLine chỉ dùng khi chuyển động bật
    expect(paragraph.querySelector('b, [aria-hidden]')).toBeNull()
  })

  test('reduced motion: TextRibbon stands still and never listens to scrolling', () => {
    const control = motionOn(true)
    const listen = vi.spyOn(window, 'addEventListener')
    renderPage(<TextRibbon rows={ROWS} label="Việc trong một chuyến" />)
    expect(control.instances).toHaveLength(0)
    expect(listen.mock.calls.some(([type]) => type === 'scroll')).toBe(false)
    expect(within(screen.getByRole('list', { name: 'Việc trong một chuyến' })).getAllByRole('listitem')).toHaveLength(4)
  })
})

describe('motion on', () => {
  test('FlowHeading: exact name, one piece per grapheme with diacritics kept, NBSP holds words together, own gate, done after the last', () => {
    const control = motionOn()
    renderPage(<FlowHeading as="h2" text={`Kho${NBSP}Long Bình đã xếp`} />)
    const heading = screen.getByRole('heading', { level: 2, name: /^Kho\sLong Bình đã xếp$/ })
    // Bộ so chữ của Testing Library gộp mọi khoảng trắng, kể cả khoảng trắng không ngắt
    expect(screen.getByText('Kho Long Bình đã xếp')).toHaveClass('sr-only', 'select-none')
    const flow = heading.querySelector('[aria-hidden="true"][data-flow]')
    if (!flow) throw new Error('Không có bản trang trí')
    // Bốn từ: "Kho Long" dính nhau qua khoảng trắng không ngắt
    expect([...flow.querySelectorAll('.reveal-flow-word')].map((word) => word.textContent)).toStrictEqual([`Kho${NBSP}Long`, 'Bình', 'đã', 'xếp'])
    const chars = [...flow.querySelectorAll<HTMLElement>('.reveal-flow-char')]
    expect(chars.map((char) => char.textContent).join('')).toBe(`Kho${NBSP}LongBìnhđãxếp`)
    expect(chars.map((char) => char.style.getPropertyValue('--c'))).toStrictEqual(chars.map((_, index) => String(index)))
    expect(heading.style.getPropertyValue('--flow-step')).toMatch(/ms$/)

    expect(heading).toHaveAttribute('data-reveal-gate')
    control.trigger(heading)
    expect(heading).toHaveAttribute('data-shown')
    finishAnimation(chars.at(-1) ?? heading, 'reveal-flow')
    expect(heading).toHaveAttribute('data-flow-done')
    // Cấu trúc ở lại sau khi chạy: không đổi bố cục
    expect(heading.querySelectorAll('.reveal-flow-char')).toHaveLength(chars.length)
  })

  test('FlowHeading inside a group follows the group gate and adds its delay', () => {
    motionOn()
    renderPage(
      <Reveal group data-testid="nhom">
        <FlowHeading as="h3" text="Lập chuyến" delay={200} />
      </Reveal>,
    )
    const heading = screen.getByRole('heading', { level: 3, name: 'Lập chuyến' })
    expect(heading).not.toHaveAttribute('data-reveal-gate')
    expect(heading.closest('[data-reveal-gate]')).toBe(screen.getByTestId('nhom'))
    expect(heading.style.getPropertyValue('--reveal-delay')).toContain('200ms')
  })

  test('LineRise: one sr-only copy of the whole text, aria-hidden lines in masks with --l, renderLine content, mask dropped when done', () => {
    const control = motionOn()
    renderPage(<LineRise as="p" lines={LINES} renderLine={(line, index) => <b data-line={index}>{line}</b>} data-testid="cau" />)
    const paragraph = screen.getByTestId('cau')
    expect(within(paragraph).getByText(LINES)).toHaveClass('sr-only', 'select-none')
    const inners = [...paragraph.querySelectorAll<HTMLElement>('[aria-hidden="true"] .reveal-line > .reveal-line-inner')]
    expect(inners.map((inner) => [inner.style.getPropertyValue('--l'), inner.querySelector('b')?.getAttribute('data-line')])).toStrictEqual([
      ['0', '0'],
      ['1', '1'],
      ['2', '2'],
    ])
    control.trigger(paragraph)
    expect(paragraph).toHaveAttribute('data-shown')
    finishAnimation(inners.at(-1) ?? paragraph, 'reveal-line')
    expect(paragraph).toHaveAttribute('data-lines-done')
  })

  test('TextRibbon: each phrase read once, rows run opposite ways, and without view timeline the scroll progress is written while visible', () => {
    const control = motionOn()
    // jsdom trả lời có mọi thuộc tính CSS: giả một trình duyệt thiếu view timeline
    vi.stubGlobal('CSS', { supports: () => false })
    // Khung hình chạy ngay: ghi tiến độ đồng bộ để đọc được trong test
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    vi.stubGlobal('cancelAnimationFrame', () => undefined)
    const view = renderPage(<TextRibbon rows={ROWS} label="Việc trong một chuyến" travel={0.4} />)
    const list = screen.getByRole('list', { name: 'Việc trong một chuyến' })
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual(ROWS.flat())
    const ribbon = list.parentElement
    if (!ribbon) throw new Error('Không có dải chữ')
    expect(ribbon.style.getPropertyValue('--ribbon-shift')).toBe('-10.000%')
    const tracks = [...ribbon.querySelectorAll('[aria-hidden="true"] .reveal-ribbon-track')]
    expect(tracks.map((track) => track.getAttribute('data-dir'))).toStrictEqual(['left', 'right'])
    expect(tracks[0]?.textContent?.split(ROWS[0][0]).length).toBeGreaterThan(2)

    // Chỉ nghe cuộn khi dải trong khung nhìn; tiến độ cover: mép trên ở giữa khung nhìn cao 768 → 0,5
    const box = vi.spyOn(ribbon, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 384, 1000, 0))
    expect(ribbon.style.getPropertyValue('--scroll-p')).toBe('')
    control.trigger(ribbon)
    expect(ribbon.style.getPropertyValue('--scroll-p')).toBe('0.5000')
    box.mockReturnValue(new DOMRect(0, 768, 1000, 0))
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(ribbon.style.getPropertyValue('--scroll-p')).toBe('0.0000')

    const remove = vi.spyOn(window, 'removeEventListener')
    view.unmount()
    expect(remove.mock.calls.some(([type]) => type === 'scroll')).toBe(true)
  })

  test('TextRibbon leaves scrolling to CSS when the browser has view timelines', () => {
    const control = motionOn()
    vi.stubGlobal('CSS', { supports: (query: string) => query === 'animation-timeline: view()' })
    renderPage(<TextRibbon rows={ROWS} label="Việc trong một chuyến" />)
    const ribbon = screen.getByRole('list', { name: 'Việc trong một chuyến' }).parentElement
    expect(control.instances.some((observer) => ribbon && observer.targets.has(ribbon))).toBe(false)
  })
})
