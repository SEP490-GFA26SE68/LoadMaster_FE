import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { StrictMode } from 'react'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { installFakeIntersectionObserver, type FakeIntersectionObserverControl } from '@/test/intersection-observer'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { LandingSteps } from './LandingSteps'
import { RevealProvider } from './reveal'

/**
 * "Cách hoạt động" của trang giới thiệu (AGENTS mục 1, 5): danh sách luôn đúng bốn bước, lời của Lumo cho từng bước nằm trong mục của
 * danh sách. jsdom không có IntersectionObserver nên trang tĩnh, không khung dính; test khung dính cài observer giả và `matchMedia` từ
 * 1.024 px rồi tự báo bước đang đọc. Khung dính (`aria-hidden`) có tên bước, bốn đoạn tiến độ và một cảnh cho mỗi mục (`data-scene`).
 */
const WIDE = '(min-width: 1024px)'
/** Dải giữa khung nhìn mà `useActiveStep` theo dõi. */
const READING_BAND = '-45% 0px -45% 0px'
const TITLES = ['Nhập kiện và yêu cầu giao', 'Lập chuyến, tối ưu tuyến', 'Xếp 3D, so sánh, duyệt', 'Soạn, xếp, giao, giám sát']
const NOTES = [
  'Mỗi kiện có nhãn QR riêng, nên lúc soạn, xếp hay dỡ đều đối chiếu được.',
  'Điểm giao sinh ra từ yêu cầu giao; tối ưu tuyến xếp thứ tự đi và tính giờ đến dự kiến.',
  'Chỉ bản đã duyệt mới tới kho và tài xế; đổi xe hay kiện sau đó thì phải tối ưu lại.',
  'Kho đối chiếu từng kiện khi xếp, tài xế đối chiếu khi dỡ — đều theo phương án đã duyệt.',
]
const DONE = 'Giao xong điểm cuối là có báo cáo chuyến.'

let io: FakeIntersectionObserverControl | null = null
let media: MatchMediaControl | null = null

afterEach(() => {
  // Gỡ cây React trước để effect dọn observer và người nghe `matchMedia` trên chính bản giả, rồi mới trả lại bản giả
  cleanup()
  io?.restore()
  media?.restore()
  io = null
  media = null
})

function renderSteps({ strict = false } = {}) {
  const tree = (
    <I18nProvider>
      <RevealProvider>
        <LandingSteps />
      </RevealProvider>
    </I18nProvider>
  )
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

/** Có observer và màn từ 1.024 px (hay hẹp hơn); `reduce` là người xem xin giảm chuyển động. */
function browser(wide: boolean, reduce = false) {
  io = installFakeIntersectionObserver()
  media = installMatchMedia({ [WIDE]: wide, '(prefers-reduced-motion: reduce)': reduce })
  return { io, media }
}

function region() {
  return screen.getByRole('region', { name: 'Cách hoạt động' })
}

/** Khung dính: khối `sticky` duy nhất của phần này. */
function stageOf(section: HTMLElement): HTMLElement | null {
  return section.querySelector<HTMLElement>('.sticky')
}

/** Cảnh đang hiện của khung dính — không tính cảnh cũ đang mờ đi. */
function sceneOf(stage: HTMLElement): string | null {
  return stage.querySelector('[data-scene]:not([data-leaving])')?.getAttribute('data-scene') ?? null
}

/** Bốn đoạn tiến độ dưới tên bước. */
function progressOf(stage: HTMLElement): (string | null)[] {
  return [...stage.querySelectorAll('.lp-stage-step')].map((segment) => segment.getAttribute('data-state'))
}

/** Các observer của bước đang đọc còn theo dõi phần tử nào đó. */
function stepObservers(control: FakeIntersectionObserverControl) {
  return control.instances.filter((observer) => observer.rootMargin === READING_BAND && observer.targets.size > 0)
}

/** jsdom chưa có `AnimationEvent`: React DOM nghe cả tên có tiền tố. */
function finishAnimation(el: Element, animationName: string) {
  for (const type of ['animationend', 'webkitAnimationEnd']) {
    fireEvent(el, Object.assign(new Event(type, { bubbles: true }), { animationName }))
  }
}

test('in jsdom the section is static: exactly four steps, each with its visible Lumo note, a closing note, Lumo carrying a box, no stage', () => {
  renderSteps()
  const section = region()
  const items = within(section).getAllByRole('listitem')
  expect(items).toHaveLength(4)
  items.forEach((item, index) => {
    // Tên truy cập là "Bước n:" ẩn rồi tên bước; jsdom bỏ khoảng trắng giữa hai phần khi tính tên, nên so chữ của tiêu đề
    expect(within(item).getByRole('heading', { level: 3 })).toHaveTextContent(`Bước ${index + 1}: ${TITLES[index]}`)
    expect(item).toHaveTextContent(`Lumo nói: ${NOTES[index]}`)
  })
  expect(section.querySelector('.lg\\:sr-only')).toBeNull()

  const closing = within(section).getByText(DONE)
  expect(closing).toHaveTextContent(`Lumo nói: ${DONE}`)
  expect(closing.closest('li')).toBeNull()

  expect(stageOf(section)).toBeNull()
  expect(section.querySelector('[data-step-state]')).toBeNull()
  const lumo = section.querySelectorAll('img[data-lumo]')
  expect([...lumo].map((img) => [img.getAttribute('data-lumo'), img.getAttribute('alt'), img.getAttribute('aria-hidden')])).toStrictEqual([
    ['carry', '', 'true'],
  ])
})

test('from 1,024 px a sticky Lumo stage follows the step being read; the notes stay in the list for screen readers', () => {
  const { io: control } = browser(true)
  renderSteps()
  const section = region()
  const items = within(section).getAllByRole('listitem')
  expect(items).toHaveLength(4)
  const stage = stageOf(section)
  expect(stage).toHaveAttribute('aria-hidden', 'true')
  if (!stage) throw new Error('Không có khung dính')
  // Chỉ một Lumo trong phần: Lumo của khung dính
  expect([...section.querySelectorAll('img[data-lumo]')].every((img) => stage.contains(img))).toBe(true)
  expect(stage.querySelector('img[data-lumo="carry"]')).not.toBeNull()
  expect(stage).toHaveTextContent(NOTES[0] ?? '')
  expect(stage).toHaveTextContent(TITLES[0] ?? '')
  expect(sceneOf(stage)).toBe('intake')
  expect(stage.querySelectorAll('[data-scene]')).toHaveLength(1)
  expect(progressOf(stage)).toStrictEqual(['active', 'todo', 'todo', 'todo'])
  // Chuyển động bật: các mảnh của cảnh hiện dần theo mốc riêng
  expect(stage.querySelector('[data-scene] .reveal-piece')).not.toBeNull()
  items.forEach((item, index) => {
    const note = item.querySelector('p.lg\\:sr-only')
    expect(note).toHaveTextContent(`Lumo nói: ${NOTES[index]}`)
  })
  expect(items.map((item) => item.getAttribute('data-step-state'))).toStrictEqual(['active', 'todo', 'todo', 'todo'])

  const [steps, ...others] = stepObservers(control)
  expect(others).toHaveLength(0)
  if (!steps) throw new Error('Không có observer của bước đang đọc')
  expect(steps.targets.size).toBe(5)

  const third = items[2]
  if (!third) throw new Error('Thiếu bước 3')
  control.trigger(third)
  expect(items.map((item) => item.getAttribute('data-step-state'))).toStrictEqual(['done', 'done', 'active', 'todo'])
  expect(stage.querySelector('img[data-lumo="tablet"]')).not.toBeNull()
  expect(stage.querySelector('img[data-lumo="carry"]')).toBeNull()
  expect(stage).toHaveTextContent(NOTES[2] ?? '')
  // Số, tên bước và cảnh mờ chéo: cái cũ ở lại tới khi mờ hết rồi mới gỡ
  expect(sceneOf(stage)).toBe('optimize')
  expect(stage.querySelector('[data-scene][data-leaving]')).toHaveAttribute('data-scene', 'intake')
  const leaving = stage.querySelector('.lp-swap-out')
  expect(leaving).toHaveTextContent('01')
  if (leaving) finishAnimation(leaving, 'lp-fade-out')
  expect(stage.querySelector('.lp-swap-out')).toBeNull()
  expect(stage.querySelectorAll('[data-scene]')).toHaveLength(1)
  expect(stage).toHaveTextContent('03')
  expect(stage).toHaveTextContent(TITLES[2] ?? '')
  expect(progressOf(stage)).toStrictEqual(['done', 'done', 'active', 'todo'])

  // Câu kết là mục số 4: chuyến đã giao xong, mọi bước đã qua
  const closing = section.querySelector<HTMLElement>('[data-step="4"]')
  if (!closing) throw new Error('Thiếu câu kết')
  expect(closing).toHaveTextContent(`Lumo nói: ${DONE}`)
  control.trigger(closing)
  expect(closing).toHaveAttribute('data-step-state', 'active')
  expect(items.every((item) => item.getAttribute('data-step-state') === 'done')).toBe(true)
  expect(stage.querySelector('img[data-lumo="done"]')).not.toBeNull()
  expect(stage).toHaveTextContent(DONE)
  expect(stage).toHaveTextContent('04')
  expect(stage).toHaveTextContent('Chuyến đã giao xong')
  expect(sceneOf(stage)).toBe('done')
  expect(progressOf(stage)).toStrictEqual(['done', 'done', 'done', 'done'])
  expect(stage).toHaveAttribute('aria-hidden', 'true')
})

test('the stage draws one scene per item — packages and requirement, route, plans A · B · C, unloading at the rear door, delivered trip — with only stop numbers and plan letters as content', () => {
  const { io: control } = browser(true, true)
  renderSteps()
  const section = region()
  const stage = stageOf(section)
  if (!stage) throw new Error('Không có khung dính')
  const targets = [...section.querySelectorAll<HTMLElement>('[data-step]')]
  expect(targets).toHaveLength(5)
  const seen = targets.map((target) => {
    control.trigger(target)
    const scenes = stage.querySelectorAll('[data-scene]')
    expect(scenes).toHaveLength(1)
    const [scene] = scenes
    return [scene?.getAttribute('data-scene'), [...(scene?.querySelectorAll('text') ?? [])].map((text) => text.textContent)]
  })
  expect(seen).toStrictEqual([
    ['intake', ['Yêu cầu giao']],
    ['plan', ['Kho', '1', '2', '3', '4']],
    ['optimize', ['A', 'B', 'C', 'Đã duyệt', '1', '2', '3', '4']],
    ['operate', ['4', '3', '2', '1', 'Cửa sau', '1']],
    ['done', ['1', '2', '3', '4', 'Báo cáo chuyến']],
  ])
  // Cảnh là hình trang trí trong khung `aria-hidden`; giảm chuyển động thì cảnh tĩnh, không mảnh nào chờ hiện
  expect(stage).toHaveAttribute('aria-hidden', 'true')
  expect(stage.querySelector('[data-scene] .reveal-piece, [data-scene] .lp-beam')).toBeNull()
})

test('narrower than 1,024 px there is no stage; widening the window brings it, and unmounting stops observing and listening', () => {
  const { io: control, media: queries } = browser(false)
  const view = renderSteps()
  expect(stageOf(region())).toBeNull()
  expect(region().querySelector('img[data-lumo="carry"]')).not.toBeNull()
  expect(region().querySelector('[data-step-state]')).toBeNull()
  expect(stepObservers(control)).toHaveLength(0)

  queries.set(WIDE, true)
  expect(stageOf(region())).not.toBeNull()
  expect(within(region()).getAllByRole('listitem')).toHaveLength(4)
  expect(stepObservers(control)).toHaveLength(1)

  view.unmount()
  expect(stepObservers(control)).toHaveLength(0)
  expect(queries.listeners(WIDE)).toBe(0)
})

test('StrictMode keeps one observer of the step being read; with reduced motion the stage changes at once, without a crossfade', () => {
  const { io: control } = browser(true, true)
  renderSteps({ strict: true })
  const [steps, ...others] = stepObservers(control)
  expect(others).toHaveLength(0)
  if (!steps) throw new Error('Không có observer của bước đang đọc')

  const last = within(region()).getAllByRole('listitem')[3]
  if (!last) throw new Error('Thiếu bước 4')
  control.trigger(last)
  const stage = stageOf(region())
  expect(stage?.querySelector('img[data-lumo="scan"]')).not.toBeNull()
  expect(stage?.querySelector('.lp-swap-out, .lp-swap-in')).toBeNull()
  expect(stage).toHaveTextContent('04')
  expect(stage).not.toHaveTextContent('01')
  expect(stage?.querySelectorAll('[data-scene]')).toHaveLength(1)
  expect(stage?.querySelector('[data-scene]')).toHaveAttribute('data-scene', 'operate')
})

test('with motion each step title flows in letter by letter with its group, keeping the name "Bước n: title"; the stage title flows too', () => {
  browser(true)
  renderSteps()
  const items = within(region()).getAllByRole('listitem')
  const first = items[0]
  if (!first) throw new Error('Thiếu bước 1')
  const heading = within(first).getByRole('heading', { level: 3, name: /^Bước 1:\s?Nhập kiện và yêu cầu giao$/ })
  // Không tự làm cổng: chạy theo mục của danh sách
  expect(heading).not.toHaveAttribute('data-reveal-gate')
  expect(heading.closest('[data-reveal-gate]')).toBe(first)
  const flow = heading.querySelector('[aria-hidden="true"][data-flow]')
  // 20 chữ, mỗi chữ (kể cả có dấu chồng) là một mảnh; 6 từ không ngắt dòng bên trong
  expect(flow?.querySelectorAll('.reveal-flow-char')).toHaveLength(20)
  expect(flow?.querySelectorAll('.reveal-flow-word')).toHaveLength(6)
  expect([...(flow?.querySelectorAll('.reveal-flow-char') ?? [])].map((char) => char.textContent).slice(0, 4)).toStrictEqual(['N', 'h', 'ậ', 'p'])
  const last = flow?.querySelector('[data-last]')
  if (!last) throw new Error('Không thấy chữ cuối')
  finishAnimation(last, 'reveal-flow')
  expect(heading).toHaveAttribute('data-flow-done')

  const stage = stageOf(region())
  expect(stage?.querySelector('[data-flow]')).toHaveTextContent(TITLES[0] ?? '')
})
