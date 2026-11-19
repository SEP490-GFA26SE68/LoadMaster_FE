import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { installFakeIntersectionObserver, type FakeIntersectionObserverControl } from '@/test/intersection-observer'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { runLandingSample } from '../landing-sample-api'
import { LandingJourney } from './LandingJourney'

/**
 * "Một chuyến hàng trên LoadMaster": năm chặng, mỗi chặng một vai trò; bảng ba phương án và số của điểm 1 đọc lần chạy mẫu (cùng truy vấn
 * với khung 3D ở đầu trang); thùng xe dính theo cuộn chỉ là hình. jsdom không có Web Worker nên mặc định lần chạy mẫu không chạy.
 */
const CHAPTERS = [
  ['Lập chuyến và chọn phương án', 'Điều phối viên'],
  ['Soạn và xếp ở kho', 'Nhân viên kho'],
  ['Trên đường', 'Điều phối viên'],
  ['Tại điểm giao', 'Tài xế'],
  ['Giao xong, báo cáo và tính lương', 'Quản lý công ty'],
] as const

window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

function renderJourney(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <LandingJourney />
      </I18nProvider>
    </QueryClientProvider>,
  )
  const section = screen.getByRole('region', { name: 'Một chuyến hàng trên LoadMaster' })
  const legs = [...screen.getByRole('list', { name: 'Năm chặng của một chuyến hàng' }).children] as HTMLElement[]
  return { section, legs }
}

/** Đặt mép trên của năm chặng so với khung nhìn (mỗi chặng cao 400 px). */
function place(legs: readonly HTMLElement[], tops: readonly number[]) {
  legs.forEach((leg, index) => {
    const top = tops[index] ?? 0
    leg.getBoundingClientRect = () => ({ top, bottom: top + 400, height: 400, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) })
  })
}

const reached = (legs: readonly HTMLElement[]) => legs.map((leg) => leg.hasAttribute('data-reached'))

let io: FakeIntersectionObserverControl | null = null
let media: MatchMediaControl | null = null

afterEach(() => {
  cleanup()
  io?.restore()
  media?.restore()
  io = null
  media = null
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('five legs in order, each with the role doing the work; the truck is a picture; without IntersectionObserver nothing waits', () => {
  const { section, legs } = renderJourney()
  expect(section).toHaveAttribute('id', 'cach-hoat-dong')
  expect(legs.map((leg) => within(leg).getByRole('heading', { level: 3 }).textContent)).toStrictEqual(CHAPTERS.map(([title]) => title))
  // Vai trò làm chính của từng chặng: nhãn vai trò nằm trong đúng chặng đó
  CHAPTERS.forEach(([, role], index) => expect(within(legs[index]!).getByText(role)).toBeInTheDocument())
  // Hình thùng xe chỉ để nhìn: chữ của từng chặng đã nói điều hình vẽ
  expect(screen.getByText('Cửa sau').closest('[aria-hidden]')).not.toBeNull()
  // Không IntersectionObserver: không ghi tiến độ, CSS giữ thùng đầy; không chặng nào bị ẩn
  expect(section).not.toHaveAttribute('data-chapter')
  expect(section.style.getPropertyValue('--p')).toBe('')
  expect(reached(legs)).toStrictEqual([false, false, false, false, false])
  // Không Web Worker: bảng không có số, một câu nói vì sao; thẻ điểm 1 chỉ có nhãn
  expect(screen.getByText(/^Trình duyệt này không chạy bộ tối ưu mẫu/)).toHaveAttribute('data-journey-plans', 'off')
  expect(screen.getByText('Ở điểm 1 · Siêu thị').closest('[data-journey-stop]')).toHaveAttribute('data-journey-stop', 'pending')
  expect(screen.queryByText(/MOCK/)).not.toBeInTheDocument()
})

test('scrolling writes the leg being read straight to the DOM: progress, chapter and the legs already reached; leaving the view stops it', () => {
  io = installFakeIntersectionObserver()
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
  vi.stubGlobal('innerHeight', 1000)
  const { section, legs } = renderJourney()
  const frame = () => act(() => {
    vi.advanceTimersByTime(20)
  })
  // Mốc là 55 % chiều cao khung nhìn (550 px): chặng 3 đã qua mốc 250 px trên 400 px
  place(legs, [-500, -100, 300, 700, 1100])
  io.trigger(section)
  frame()
  expect(section.style.getPropertyValue('--p')).toBe('0.525')
  expect(section).toHaveAttribute('data-chapter', '2')
  expect(reached(legs)).toStrictEqual([true, true, true, false, false])

  place(legs, [-1300, -900, -500, -100, 300])
  window.dispatchEvent(new Event('scroll'))
  frame()
  expect(section.style.getPropertyValue('--p')).toBe('0.925')
  expect(section).toHaveAttribute('data-chapter', '4')
  expect(reached(legs)).toStrictEqual([true, true, true, true, true])

  // Ra khỏi khung nhìn: thôi nghe cuộn
  io.trigger(section, { isIntersecting: false })
  place(legs, [-500, -100, 300, 700, 1100])
  window.dispatchEvent(new Event('scroll'))
  frame()
  expect(section).toHaveAttribute('data-chapter', '4')
})

test('with reduced motion the picture changes per leg, not per scroll step', () => {
  io = installFakeIntersectionObserver()
  media = installMatchMedia({ '(prefers-reduced-motion: reduce)': true })
  vi.useFakeTimers({ toFake: ['requestAnimationFrame', 'cancelAnimationFrame'] })
  vi.stubGlobal('innerHeight', 1000)
  const { section, legs } = renderJourney()
  place(legs, [-500, -100, 300, 700, 1100])
  io.trigger(section)
  act(() => {
    vi.advanceTimersByTime(20)
  })
  expect(section.style.getPropertyValue('--p')).toBe('0.5')
  expect(section).toHaveAttribute('data-chapter', '2')
})

test('with the sample run computed, the table compares A · B · C with a grey "Best" tag and the stop card counts stop 1 on plan C', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // Chạy bộ tối ưu mẫu trước khi giả Web Worker (jsdom tính trên luồng gọi), rồi đặt kết quả vào đúng truy vấn của khung 3D
  client.setQueryData(['landing', 'sample-candidates'], await runLandingSample())
  vi.stubGlobal('Worker', class {})
  renderJourney(client)

  const table = screen.getByRole('table', { name: 'So sánh ba phương án của lần chạy mẫu' })
  expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toStrictEqual([
    'Chỉ số', 'ATối đa thể tích', 'BCân bằng tải trục', 'CÍt dỡ-xếp lại',
  ])
  expect(within(table).getAllByRole('rowheader').map((header) => header.textContent)).toStrictEqual([
    'Lấp đầy', 'Chênh tải hai trục', 'Dỡ-xếp lại', 'Chưa xếp',
  ])
  const cells = (name: RegExp) => within(within(table).getByRole('row', { name })).getAllByRole('cell').map((cell) => cell.textContent)
  // Cùng thể tích và cùng số kiện chưa xếp ở cả ba: không đánh dấu; B cân trục nhất, C không dỡ-xếp lại kiện nào
  expect(cells(/^Chưa xếp/)).toStrictEqual(['0', '0', '0'])
  expect(cells(/^Dỡ-xếp lại/)).toStrictEqual(['21', expect.any(String), '0Tốt nhất'])
  expect(cells(/^Chênh tải hai trục/)[1]).toMatch(/Tốt nhất$/)
  expect(within(table).getAllByText('Tốt nhất')).toHaveLength(2)
  expect(screen.getByText(/^Số của lần chạy mẫu 366 kiện/)).toHaveAttribute('data-journey-plans', 'ready')

  const stop = screen.getByText('Ở điểm 1 · Siêu thị').closest<HTMLElement>('[data-journey-stop]')
  expect(stop).toHaveAttribute('data-journey-stop', 'ready')
  const card = within(stop as HTMLElement)
  expect(card.getAllByRole('term')[0]).toHaveTextContent('Kiện của điểm')
  expect(card.getAllByRole('definition')[0]).toHaveTextContent('96')
  expect(card.getByText('Đếm trên phương án C của lần chạy mẫu ở đầu trang.')).toBeInTheDocument()
  expect(screen.queryByText(/MOCK/)).not.toBeInTheDocument()
})
