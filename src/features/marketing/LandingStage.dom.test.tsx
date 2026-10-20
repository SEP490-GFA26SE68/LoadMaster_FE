import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { installFakeIntersectionObserver, type FakeIntersectionObserverControl } from '@/test/intersection-observer'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { LandingStage } from './LandingStage'

/**
 * Khung 3D kể chuyện của phần mở đầu trang giới thiệu, với bộ tối ưu mô phỏng thật (chuyến mẫu 366 kiện). jsdom không có WebGL nên cổng
 * của khung được ép mở và khung 3D là bản giả: báo đã vẽ khung hình đầu, hoặc báo hỏng. Thời gian của chuyện chạy bằng đồng hồ giả
 * (`requestAnimationFrame`, `performance`) — chỉ đi khi test tua; 1,2 giây chờ trước khi chuyện bắt đầu vẫn là giờ thật.
 */
const stage = vi.hoisted(() => ({ gate: 'go' as 'off' | 'wait' | 'go', fail: false }))

vi.mock('./useStageGate', () => ({ useStageGate: () => stage.gate }))
vi.mock('@/features/viewer3d/LandingStageViewer', async () => {
  const { createElement, useEffect } = await import('react')
  function FakeViewer({ view, onReady, onFail }: { view: string; onReady: () => void; onFail: () => void }) {
    useEffect(() => {
      if (stage.fail) onFail()
      else onReady()
    }, [onReady, onFail])
    return createElement('div', { 'data-testid': 'viewer', 'data-viewer-view': view })
  }
  return { default: FakeViewer }
})

const WIDE = { '(min-width: 80rem)': true, '(min-width: 48rem)': true }
const SLOW = { timeout: 10_000 }

let media: MatchMediaControl | undefined
let io: FakeIntersectionObserverControl | undefined

beforeEach(() => {
  sessionStorage.clear()
  stage.gate = 'go'
  stage.fail = false
})
afterEach(() => {
  vi.useRealTimers()
  media?.restore()
  io?.restore()
  media = undefined
  io = undefined
})

function renderStage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <LandingStage />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const figure = () => screen.getByRole('figure', { name: 'Chuyến mẫu' })
const card = () => within(figure())
/** Tư thế và câu của Lumo dẫn chuyện (bản giữ chỗ trong suốt không có ảnh, bong bóng của nó không có `data-side`). */
const pose = () => figure().querySelector('img[data-lumo]')?.getAttribute('data-lumo')
const narration = () => figure().querySelector('p[data-side]')?.textContent ?? ''
const progress = () => card().getByText(/^Đang xếp \d+ \/ 366$/)
/** Tua đồng hồ giả của chuyện (một khung hình mỗi 16 ms). */
const play = (ms: number) => act(() => {
  vi.advanceTimersByTime(ms)
})
const fakeStoryClock = () => vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame', 'performance'] })

test('the sample trip plays once: app chips on the trip card, Lumo narrates each phase, run figures with MOCK RESULT only at the end', async () => {
  media = installMatchMedia(WIDE)
  fakeStoryClock()
  renderStage()
  // Bộ tối ưu đang tính trên trình duyệt: chưa số nào của lần chạy
  expect(card().getByText('Đang tính phương án mẫu…')).toBeInTheDocument()
  expect(pose()).toBe('tablet')
  expect(narration()).toContain('Mình đang nhờ bộ tối ưu mô phỏng tính một chuyến mẫu.')
  const readout = screen.getByRole('group', { name: 'Kết quả của lần chạy' })
  expect(within(readout).getByText('Số liệu của lần chạy hiện ra khi xếp xong.')).toBeInTheDocument()
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()

  expect(await card().findByText('Đã tính phương án', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(figure()).toHaveAttribute('data-story-status', 'playing'), SLOW)
  expect(pose()).toBe('carry')
  expect(narration()).toContain('Kiện của mỗi điểm giao chờ ở một làn')

  play(2500)
  expect(pose()).toBe('tablet')
  expect(narration()).toContain('Thùng được chia vùng')
  expect(card().getByText('Đã tính phương án')).toBeInTheDocument()

  play(2500)
  expect(card().getByText('Đang xếp hàng')).toBeInTheDocument()
  expect(progress()).toBeInTheDocument()
  expect(pose()).toBe('point')
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()

  // Một nút duy nhất đổi chữ theo trạng thái: tạm dừng thì số kiện trong thùng đứng yên, focus không rời nút
  const user = userEvent.setup()
  const button = screen.getByRole('button', { name: 'Tạm dừng chuyến mẫu' })
  await user.click(button)
  expect(figure()).toHaveAttribute('data-story-status', 'paused')
  expect(screen.getByRole('button', { name: 'Tiếp tục chuyến mẫu' })).toBe(button)
  expect(button).toHaveFocus()
  const shown = progress().textContent ?? ''
  play(1000)
  expect(progress()).toHaveTextContent(shown)

  await user.click(button)
  expect(screen.getByRole('button', { name: 'Tạm dừng chuyến mẫu' })).toBe(button)
  play(5000)
  expect(figure()).toHaveAttribute('data-story-status', 'ended')
  expect(card().getByText('Xếp xong — chờ xuất phát')).toBeInTheDocument()
  expect(pose()).toBe('done')
  expect(narration()).toContain('Xếp xong, chờ xuất phát.')
  // Số của chính lần chạy này, một nhãn MOCK RESULT duy nhất nằm trong dải số
  expect(screen.getAllByText('MOCK RESULT')).toHaveLength(1)
  expect(within(readout).getByText('MOCK RESULT')).toBeInTheDocument()
  expect(within(readout).getByText('366 / 366')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Xếp lại thùng xe từ đầu' })).toBe(button)
  expect(button).toHaveFocus()

  // Xếp lại từ thùng rỗng: chuyện chạy lại, dải số trở về câu giữ chỗ
  await user.click(button)
  expect(figure()).toHaveAttribute('data-story-status', 'playing')
  expect(screen.getByRole('button', { name: 'Tạm dừng chuyến mẫu' })).toBe(button)
  expect(button).toHaveFocus()
  expect(card().getByText('Đã tính phương án')).toBeInTheDocument()
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()
})

test('the story starts only once the frame is 40 % in view, holds below 20 % and goes on again from 40 %', async () => {
  media = installMatchMedia(WIDE)
  io = installFakeIntersectionObserver()
  fakeStoryClock()
  renderStage()
  const box = figure().querySelector<HTMLElement>('[data-view]')
  if (!box) throw new Error('Không thấy khung 3D')
  await card().findByText('Đã tính phương án', {}, SLOW)
  await act(() => new Promise((resolve) => setTimeout(resolve, 1300)))
  io.trigger(box, { intersectionRatio: 0.3 })
  expect(figure()).toHaveAttribute('data-story-status', 'idle')

  io.trigger(box, { intersectionRatio: 0.5 })
  expect(figure()).toHaveAttribute('data-story-status', 'playing')
  io.trigger(box, { intersectionRatio: 0.1 })
  expect(figure()).toHaveAttribute('data-story-status', 'held')
  // Giữ vì khung bị cuộn khuất không phải người xem tạm dừng: nút vẫn là "Tạm dừng"
  expect(screen.getByRole('button', { name: 'Tạm dừng chuyến mẫu' })).toBeInTheDocument()
  io.trigger(box, { intersectionRatio: 0.3 })
  expect(figure()).toHaveAttribute('data-story-status', 'held')
  io.trigger(box, { intersectionRatio: 0.5 })
  expect(figure()).toHaveAttribute('data-story-status', 'playing')
})

test('with reduced motion the trip is loaded at once: the run figures and the ready line, no story button', async () => {
  media = installMatchMedia({ ...WIDE, '(prefers-reduced-motion: reduce)': true })
  renderStage()
  await waitFor(() => expect(figure()).toHaveAttribute('data-story-status', 'ended'), SLOW)
  expect(card().getByText('Xếp xong — chờ xuất phát')).toBeInTheDocument()
  expect(within(screen.getByRole('group', { name: 'Kết quả của lần chạy' })).getByText('MOCK RESULT')).toBeInTheDocument()
  expect(pose()).toBe('done')
  expect(screen.queryByRole('button', { name: /chuyến mẫu|Xếp lại/ })).not.toBeInTheDocument()
})

test('three views, overview by default from 1,280 px: the chosen view goes to the 3D frame', async () => {
  media = installMatchMedia(WIDE)
  const user = userEvent.setup()
  renderStage()
  const views = screen.getByRole('group', { name: 'Góc nhìn' })
  const pressed = () => within(views).getAllByRole('button').map((view) => [view.textContent, view.getAttribute('aria-pressed')])
  expect(pressed()).toStrictEqual([['Toàn cảnh', 'true'], ['Thùng xe', 'false'], ['Vùng điểm giao', 'false']])

  await user.click(within(views).getByRole('button', { name: 'Vùng điểm giao' }))
  expect(pressed()).toStrictEqual([['Toàn cảnh', 'false'], ['Thùng xe', 'false'], ['Vùng điểm giao', 'true']])
  expect(await screen.findByTestId('viewer', {}, SLOW)).toHaveAttribute('data-viewer-view', 'zones')
})

test('on a phone the frame opens on the truck body, the views sit under it and the delivery order lists the depot and four stops', () => {
  media = installMatchMedia({})
  renderStage()
  const box = figure().querySelector('[data-view]')
  expect(box).toHaveAttribute('data-view', 'truck')
  const views = screen.getByRole('group', { name: 'Góc nhìn' })
  expect(within(views).getByRole('button', { name: 'Thùng xe' })).toHaveAttribute('aria-pressed', 'true')
  expect(box?.compareDocumentPosition(views)).toBe(Node.DOCUMENT_POSITION_FOLLOWING)
  const route = screen.getByRole('list', { name: 'Thứ tự giao' })
  expect(within(route).getAllByRole('listitem')).toHaveLength(5)
})

test('when the 3D frame fails, the illustration takes its place and Lumo says why: no trip card, controls or figures', async () => {
  media = installMatchMedia(WIDE)
  stage.fail = true
  renderStage()
  expect(await screen.findByText(/^Hình minh hoạ: hàng của điểm giao cuối nằm sâu nhất/, {}, SLOW)).toBeInTheDocument()
  expect(document.querySelector('p[data-side]')).toHaveTextContent('Khung xe không hiện được ở đây, nên mình gửi bạn hình minh hoạ.')
  expect(document.querySelector('img[data-lumo]')).toHaveAttribute('data-lumo', 'point')
  expect(screen.queryByText('Chuyến mẫu')).not.toBeInTheDocument()
  expect(screen.queryByRole('button')).not.toBeInTheDocument()
  expect(screen.queryByText('Thứ tự giao')).not.toBeInTheDocument()
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()
})
