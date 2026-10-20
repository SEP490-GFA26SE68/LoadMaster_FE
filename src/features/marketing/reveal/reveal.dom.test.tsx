import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { StrictMode, type ReactNode } from 'react'
import { afterEach, describe, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { installFakeIntersectionObserver, type FakeIntersectionObserverControl } from '@/test/intersection-observer'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { SectionHeading } from '../SectionHeading'
import { LumoSays, Odometer, Reveal, RevealProvider, useRevealMotion, useRevealRef } from '.'

/**
 * Hệ hiện chữ của trang giới thiệu (AGENTS mục 1, 8). jsdom không có IntersectionObserver nên mặc định chuyển động tắt và DOM đúng như
 * chưa có hệ này; test cần chuyển động thì cài observer giả và `matchMedia` điều khiển được rồi tự báo giao cắt.
 */
const REDUCE = '(prefers-reduced-motion: reduce)'
const TITLE = 'Tận dụng thùng xe, dỡ đúng thứ tự'
const LEDE = 'Mỗi kiện có nhãn QR riêng.'

let io: FakeIntersectionObserverControl | null = null
let media: MatchMediaControl | null = null

/** Chuyển động bật: observer giả và `matchMedia` không xin giảm chuyển động (hoặc có, khi `reduce`). */
function motionOn(reduce = false) {
  io = installFakeIntersectionObserver()
  media = installMatchMedia({ [REDUCE]: reduce })
  return { io, media }
}

afterEach(() => {
  // Gỡ cây React trước, để effect dọn observer và người nghe `matchMedia` trên chính bản giả, rồi mới trả lại bản giả.
  cleanup()
  io?.restore()
  media?.restore()
  io = null
  media = null
  vi.restoreAllMocks()
})

function renderPage(ui: ReactNode, { strict = false } = {}) {
  const tree = (
    <I18nProvider>
      <RevealProvider>{ui}</RevealProvider>
    </I18nProvider>
  )
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

/**
 * Báo một animation của `el` đã chạy xong. jsdom chưa có `AnimationEvent`, nên React DOM nghe tên có tiền tố (`webkitAnimationEnd`) thay
 * cho `animationend`: gửi cả hai, kèm tên animation (sự kiện thường không có trường này).
 */
function finishAnimation(el: Element, animationName = 'reveal-rise') {
  for (const type of ['animationend', 'webkitAnimationEnd']) {
    fireEvent(el, Object.assign(new Event(type, { bubbles: true }), { animationName }))
  }
}

/** Cổng (phần tử được observer theo dõi) bao quanh tiêu đề. */
function gateOf(el: Element): HTMLElement {
  const gate = el.closest<HTMLElement>('[data-reveal-gate]')
  if (!gate) throw new Error('Không có cổng nào bao quanh phần tử')
  return gate
}

describe('motion off', () => {
  test('without IntersectionObserver nothing is split, hidden or wrapped: the DOM is exactly the heading without the provider', () => {
    const bare = render(
      <I18nProvider>
        <SectionHeading id="tieu-de" title={TITLE} lede={LEDE} />
      </I18nProvider>,
    )
    const expected = bare.container.innerHTML
    bare.unmount()

    const { container } = renderPage(<SectionHeading id="tieu-de" title={TITLE} lede={LEDE} />)
    expect(container.innerHTML).toBe(expected)
    expect(container.querySelector('[data-motion], [data-reveal-root], [data-reveal-gate]')).toBeNull()
    const heading = screen.getByRole('heading', { level: 2, name: TITLE })
    expect(heading.innerHTML).toBe(TITLE)
  })

  test('reduced motion: off, plain text, and the image of Lumo stands still with the whole sentence', () => {
    motionOn(true)
    const { container } = renderPage(
      <>
        <SectionHeading id="tieu-de" title={TITLE} lede={LEDE} />
        <LumoSays pose="explain" px={144} text="Đây là các con số cố định." side="bubble-left" />
      </>,
    )
    expect(container.querySelector('[data-motion]')).toBeNull()
    expect(screen.getByRole('heading', { level: 2, name: TITLE }).innerHTML).toBe(TITLE)
    expect(screen.getByText(LEDE).tagName).toBe('P')
    const bubble = screen.getByText(/Đây là các con số cố định\./)
    expect(bubble).toHaveTextContent('Lumo nói: Đây là các con số cố định.')
    expect(bubble.querySelector('[aria-hidden="true"]')).toBeNull()
    expect(io?.instances).toHaveLength(0)
  })

  test('outside a provider every primitive renders plain elements', () => {
    render(
      <I18nProvider>
        <Reveal as="section" kind="pop" index={2} className="khoi">
          <Odometer value="0,1 cm" />
        </Reveal>
      </I18nProvider>,
    )
    const block = screen.getByText('0,1 cm')
    expect(block.tagName).toBe('SECTION')
    expect(block.attributes).toHaveLength(1)
  })
})

describe('motion on', () => {
  test('one observer at 15 % with the bottom 10 % cut; the heading stays hidden until it fires, then gets data-shown once', () => {
    const { io } = motionOn()
    const { container } = renderPage(<SectionHeading id="tieu-de" title={TITLE} lede={LEDE} />)
    expect(container.querySelector('[data-reveal-root]')).toHaveAttribute('data-motion', 'on')
    expect(io.instances).toHaveLength(1)
    expect(io.instances[0]?.options).toEqual({ threshold: [0, 0.07, 0.15], rootMargin: '0px 0px -10% 0px' })

    const heading = screen.getByRole('heading', { level: 2, name: TITLE })
    const gate = gateOf(heading)
    expect(gate).toHaveAttribute('data-reveal-group')
    expect(gate).not.toHaveAttribute('data-shown')
    expect(heading.querySelectorAll('.reveal-word')).toHaveLength(8)

    // Lộ dưới 15 % của một khối thấp: chưa đủ
    io.trigger(gate, { intersectionRatio: 0.1, rootBounds: new DOMRect(0, 0, 1000, 800) })
    expect(gate).not.toHaveAttribute('data-shown')
    io.trigger(gate)
    expect(gate).toHaveAttribute('data-shown')
    expect(io.instances[0]?.targets.has(gate)).toBe(false)
  })

  test('an element taller than five viewports shows as soon as it enters', () => {
    const { io } = motionOn()
    renderPage(<Reveal data-testid="cao">Nội dung</Reveal>)
    const block = screen.getByTestId('cao')
    io.trigger(block, { intersectionRatio: 0.05, rootBounds: new DOMRect(0, 0, 1000, 800), boundingClientRect: new DOMRect(0, 0, 1000, 6000) })
    expect(block).toHaveAttribute('data-shown')
  })

  test('a gate with its own threshold (at) opens at 7 %; inside a group the threshold is not rendered', () => {
    const { io } = motionOn()
    renderPage(
      <>
        <Reveal at={0.07} data-testid="cao">Ô cao</Reveal>
        <Reveal data-testid="thuong">Ô thường</Reveal>
        <Reveal group>
          <Reveal at={0.07} data-testid="con">Trong nhóm</Reveal>
        </Reveal>
      </>,
    )
    const tall = screen.getByTestId('cao')
    const plain = screen.getByTestId('thuong')
    expect(tall).toHaveAttribute('data-reveal-at', '0.07')
    expect(screen.getByTestId('con')).not.toHaveAttribute('data-reveal-at')
    const lowRatio = { intersectionRatio: 0.07, rootBounds: new DOMRect(0, 0, 1000, 800), boundingClientRect: new DOMRect(0, 0, 1000, 700) }
    io.trigger(plain, lowRatio)
    expect(plain).not.toHaveAttribute('data-shown')
    io.trigger(tall, lowRatio)
    expect(tall).toHaveAttribute('data-shown')
  })

  test('the heading keeps its exact accessible name; getByText finds only the sr-only copy', () => {
    motionOn()
    renderPage(<SectionHeading id="tieu-de" title={TITLE} />)
    const heading = screen.getByRole('heading', { level: 2, name: TITLE })
    expect(screen.getAllByText(TITLE)).toHaveLength(1)
    expect(screen.getByText(TITLE)).toHaveClass('sr-only')
    expect(heading.querySelector('[aria-hidden="true"][data-words="rise"]')).toHaveTextContent(TITLE)
  })

  test('focus on a heading inside a hidden block opens its gate at once (data-instant)', () => {
    motionOn()
    renderPage(<SectionHeading id="tieu-de" title={TITLE} lede={LEDE} />)
    const heading = screen.getByRole('heading', { level: 2, name: TITLE })
    act(() => heading.focus())
    const gate = gateOf(heading)
    expect(gate).toHaveAttribute('data-shown')
    expect(gate).toHaveAttribute('data-instant')
  })

  test('printing opens every gate at once', () => {
    motionOn()
    renderPage(<SectionHeading id="tieu-de" title={TITLE} />)
    act(() => {
      window.dispatchEvent(new Event('beforeprint'))
    })
    const gate = gateOf(screen.getByRole('heading', { level: 2, name: TITLE }))
    expect(gate).toHaveAttribute('data-shown')
    expect(gate).toHaveAttribute('data-instant')
  })

  test('a paragraph returns to one plain text node after its last word animates', () => {
    motionOn()
    renderPage(<SectionHeading id="tieu-de" title={TITLE} lede={LEDE} />)
    const lede = screen.getByText(LEDE).closest('p')
    if (!lede) throw new Error('Không thấy câu mô tả')
    expect(lede.querySelectorAll('.reveal-ink')).toHaveLength(6)
    const last = lede.querySelector('[data-last]')
    if (!last) throw new Error('Không thấy từ cuối')
    finishAnimation(last)
    expect(lede.childNodes).toHaveLength(1)
    expect(lede.firstChild?.nodeType).toBe(Node.TEXT_NODE)
    expect(lede).toHaveTextContent(LEDE)
  })

  test('the odometer reads its value to screen readers while rolling, then becomes that exact string', () => {
    motionOn()
    const { container } = renderPage(
      <dl>
        <Reveal group as="div">
          <dt>Sai số</dt>
          <dd data-testid="so">
            <Odometer value="0,1 cm" />
          </dd>
        </Reveal>
      </dl>,
    )
    const value = screen.getByTestId('so')
    expect(screen.getByText('0,1 cm')).toHaveClass('sr-only')
    expect(container.querySelectorAll('.reveal-odo-cell')).toHaveLength(2)
    const last = container.querySelector('.reveal-odo-strip[data-last]')
    if (!last) throw new Error('Không thấy ô số cuối')
    finishAnimation(last)
    expect(value.innerHTML).toBe('0,1 cm')
  })

  test('blocks inside a group add their stagger and delay to the group start', () => {
    motionOn()
    renderPage(
      <Reveal group>
        <Reveal index={2} delay={100} data-testid="con">
          Thẻ
        </Reveal>
      </Reveal>,
    )
    const child = screen.getByTestId('con')
    expect(child).toHaveAttribute('data-reveal', 'rise')
    expect(child).not.toHaveAttribute('data-reveal-gate')
    expect(child.style.getPropertyValue('--reveal-delay')).toBe('calc(2 * var(--stagger-item) + 100ms)')
    expect(child.style.getPropertyValue('--i')).toBe('2')
    finishAnimation(child)
    expect(child).toHaveAttribute('data-done')
  })

  test('useRevealRef registers any element, SVG included, and calls back once when shown', () => {
    const { io } = motionOn()
    const onShow = vi.fn()
    function Beam() {
      const ref = useRevealRef<SVGGElement>(onShow)
      return (
        <svg>
          <g ref={ref} data-testid="tia" />
        </svg>
      )
    }
    renderPage(<Beam />)
    const beam = screen.getByTestId('tia')
    expect(beam).toHaveAttribute('data-reveal-gate')
    io.trigger(beam)
    io.trigger(beam)
    expect(beam).toHaveAttribute('data-shown')
    expect(onShow).toHaveBeenCalledTimes(1)
    expect(onShow).toHaveBeenCalledWith(false)
  })

  test('StrictMode: the gate is watched by the live observer and opens once', () => {
    const { io } = motionOn()
    renderPage(<SectionHeading id="tieu-de" title={TITLE} />, { strict: true })
    const gate = gateOf(screen.getByRole('heading', { level: 2, name: TITLE }))
    const live = io.instances.filter((observer) => observer.targets.size > 0)
    expect(live).toHaveLength(1)
    expect(live[0]?.targets.has(gate)).toBe(true)
    io.trigger(gate)
    expect(gate).toHaveAttribute('data-shown')
  })

  test('unmounting disconnects the observer and the reduced-motion listener', () => {
    const { io, media } = motionOn()
    const view = renderPage(<SectionHeading id="tieu-de" title={TITLE} />)
    expect(media.listeners(REDUCE)).toBeGreaterThan(0)
    view.unmount()
    expect(io.instances.every((observer) => observer.targets.size === 0)).toBe(true)
    expect(media.listeners(REDUCE)).toBe(0)
  })

  test('switching to reduced motion mid-way drops data-motion and shows plain text, for the rest of the visit', () => {
    const { media } = motionOn()
    function Probe() {
      return <output>{useRevealMotion() ? 'bật' : 'tắt'}</output>
    }
    const { container } = renderPage(
      <>
        <SectionHeading id="tieu-de" title={TITLE} />
        <Probe />
      </>,
    )
    expect(screen.getByRole('status')).toHaveTextContent('bật')
    media.set(REDUCE, true)
    expect(container.querySelector('[data-reveal-root]')).not.toHaveAttribute('data-motion')
    expect(screen.getByRole('heading', { level: 2, name: TITLE }).innerHTML).toBe(TITLE)
    media.set(REDUCE, false)
    expect(screen.getByRole('status')).toHaveTextContent('tắt')
  })

  test('Lumo speaks with an sr-only prefix, no live region, and an aria-hidden image; focus shows the whole sentence at once', () => {
    motionOn()
    const text = 'Gửi yêu cầu, đội LoadMaster tư vấn.'
    const { container } = renderPage(<LumoSays pose="idea" px={{ base: 112, md: 144, xl: 176 }} text={text} side="bubble-left" />)
    const bubble = container.querySelector('.reveal-bubble')
    if (!bubble) throw new Error('Không thấy bong bóng')
    expect(bubble).toHaveTextContent(`Lumo nói: ${text}`)
    expect(container.querySelector('[aria-live]')).toBeNull()
    expect(container.querySelector('img')).toHaveAttribute('aria-hidden')
    expect(container.querySelector('.reveal-lumo')).toHaveAttribute('data-bust')
    // Chưa lộ: phần nhìn thấy còn trống, phần còn lại giữ chỗ (trong suốt) — bong bóng đã đúng cỡ
    expect(bubble.querySelector('.reveal-type-rest')).toHaveTextContent(text)

    const root = gateOf(bubble)
    act(() => {
      root.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
    })
    expect(root).toHaveAttribute('data-instant')
    expect(bubble.querySelector('[aria-hidden="true"]')).toBeNull()
    expect(bubble).toHaveTextContent(`Lumo nói: ${text}`)
  })

  test('trigger="mount" opens Lumo as soon as it is attached', () => {
    motionOn()
    const { container } = renderPage(<LumoSays pose="point" px={128} text="Mình đang nhờ bộ tối ưu." side="bubble-right" trigger="mount" />)
    expect(container.querySelector('.reveal-lumo')).toHaveAttribute('data-shown')
  })
})
