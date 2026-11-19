import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { installFakeIntersectionObserver, type FakeIntersectionObserverControl } from '@/test/intersection-observer'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { LandingHero } from './LandingHero'
import { RevealProvider } from './reveal'

/**
 * Chữ của phần mở đầu hiện một lần khi trang mở (AGENTS mục 8): dòng mở đầu chảy từng chữ, tiêu đề nhô lên từng từ, câu mô tả đậm dần.
 * Chữ tách thành mảnh chỉ để nhìn — tên truy cập của tiêu đề, của vùng và của các nút phải đúng từng chữ ở cả hai chế độ. jsdom không có
 * IntersectionObserver nên mặc định chuyển động tắt; test cần chuyển động thì cài observer giả. Kho mẫu: nút chính là "Nhận tư vấn"
 * (bản nối máy chủ: `LandingHero.backend.dom.test.tsx`).
 */
const TITLE = 'Tới điểm nào, mở cửa là thấy hàng của điểm đó.'
const REDUCE = '(prefers-reduced-motion: reduce)'

let io: FakeIntersectionObserverControl | null = null
let media: MatchMediaControl | null = null

function renderHero({ observer = true, reduce = false } = {}) {
  if (observer) io = installFakeIntersectionObserver()
  media = installMatchMedia({ [REDUCE]: reduce })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/gioi-thieu']}>
            <RevealProvider>
              <LandingHero />
            </RevealProvider>
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

/** Nút chính của V2.3 là nền gradient `--primary-fill-*`. */
const isPrimary = (element: HTMLElement) => element.className.includes('from-primary-fill-from')

beforeEach(() => sessionStorage.clear())
afterEach(() => {
  // Gỡ cây React trước, để effect dọn observer và người nghe `matchMedia` trên chính bản giả, rồi mới trả lại bản giả
  cleanup()
  io?.restore()
  media?.restore()
  io = null
  media = null
  sessionStorage.clear()
})

test('with motion on the title is split for the eye only: one heading, one exact accessible name, and the text column opens once', () => {
  const { container } = renderHero()
  expect(container.querySelector('[data-reveal-root]')).toHaveAttribute('data-motion', 'on')

  const heading = screen.getByRole('heading', { level: 1, name: TITLE })
  expect(heading).toHaveAttribute('id', 'landing-title')
  // Bản tách từ chỉ để nhìn; trình đọc màn hình nhận đúng một câu
  expect(heading.querySelector('[aria-hidden="true"]')).not.toBeNull()
  const hero = within(screen.getByRole('region', { name: TITLE }))
  expect(hero.getAllByRole('heading')).toHaveLength(1)
  expect(hero.getByText('Lập kế hoạch chất xếp hàng 3D cho doanh nghiệp vận tải', { selector: '.sr-only' })).toBeInTheDocument()

  // Cột chữ là một cổng: chờ tới khi lộ ra, mở một lần rồi thôi theo dõi
  const gate = heading.closest<HTMLElement>('[data-reveal-gate]')
  expect(gate).not.toBeNull()
  expect(gate).not.toHaveAttribute('data-shown')
  io?.trigger(gate as HTMLElement)
  expect(gate).toHaveAttribute('data-shown')
  expect(io?.instances.some((instance) => instance.targets.has(gate as HTMLElement))).toBe(false)

  // Nút không đổi theo chuyển động: "Nhận tư vấn" là nút chính duy nhất, "Thử với hàng của bạn" là nút kính
  const consult = hero.getByRole('link', { name: 'Nhận tư vấn' })
  expect(consult).toHaveAttribute('href', '/gioi-thieu#lien-he')
  expect(hero.getAllByRole('link').filter(isPrimary)).toEqual([consult])
  expect(hero.getByRole('link', { name: 'Thử với hàng của bạn' })).toHaveAttribute('href', '/gioi-thieu#thu-ngay')
  expect(hero.queryByRole('link', { name: /Đăng ký/ })).not.toBeInTheDocument()
  // Vai trò giới thiệu ở "Một chuyến hàng", không ở phần mở đầu
  expect(hero.queryByRole('list')).not.toBeInTheDocument()
  expect(hero.queryByText(/MOCK/)).not.toBeInTheDocument()
})

test('with reduced motion, or without IntersectionObserver, the text is plain and nothing waits to be revealed', () => {
  const reduced = renderHero({ reduce: true })
  expect(reduced.container.querySelector('[data-motion], [data-reveal-gate]')).toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: TITLE }).innerHTML).toBe(TITLE)
  expect(io?.instances).toHaveLength(0)
  cleanup()
  io?.restore()
  io = null
  media?.restore()

  const bare = renderHero({ observer: false })
  expect(bare.container.querySelector('[data-motion], [data-reveal-gate]')).toBeNull()
  expect(screen.getByRole('heading', { level: 1, name: TITLE }).innerHTML).toBe(TITLE)
  expect(screen.getByRole('link', { name: 'Nhận tư vấn' })).toHaveAttribute('href', '/gioi-thieu#lien-he')
})
