import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { LandingHero } from './LandingHero'

/**
 * Phần mở đầu trang giới thiệu: tiêu đề, câu mô tả và nút chính vẽ ngay, không chờ phần 3D. Cổng của khung 3D (`useStageGate`) được ép
 * giữ hay mở; bộ máy 3D là bản giả đếm lần được nạp, bộ tối ưu mô phỏng là bản giả đếm lần được dựng — trang chỉ nạp phần 3D và chạy
 * chuyến mẫu khi cổng mở.
 */
const stage = vi.hoisted(() => ({ gate: 'wait' as 'off' | 'wait' | 'go', viewer: 0, optimizer: 0 }))

vi.mock('./useStageGate', () => ({ useStageGate: () => stage.gate }))
vi.mock('@/features/viewer3d/LandingStageViewer', () => {
  stage.viewer += 1
  return { default: () => null }
})
vi.mock('@/services/optimization', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/services/optimization')>(),
  // Bộ tối ưu giả không bao giờ xong: test chỉ hỏi chuyến mẫu đã bắt đầu tính chưa
  createOptimizationService: () => {
    stage.optimizer += 1
    return { optimize: () => new Promise(() => {}) }
  },
}))

let media: MatchMediaControl | undefined

beforeEach(() => {
  sessionStorage.clear()
  stage.gate = 'wait'
  media = installMatchMedia({ '(min-width: 80rem)': true, '(min-width: 48rem)': true })
})
afterEach(() => {
  media?.restore()
  media = undefined
})

function renderHero() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/gioi-thieu']}>
          <LandingHero />
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('the headline, lede and the one primary call to action are there at once, before any 3D or optimizer code loads', async () => {
  renderHero()
  expect(screen.getByRole('heading', { level: 1, name: 'Tận dụng thùng xe, dỡ đúng thứ tự, theo dõi tới điểm giao cuối.' }))
    .toBeInTheDocument()
  expect(screen.getByText(/^Còn xếp theo kinh nghiệm, tới điểm giao phải dỡ ra xếp lại/)).toBeInTheDocument()
  // "Nhận tư vấn" mở form liên hệ với loại yêu cầu "Xem demo" đã chọn sẵn
  expect(screen.getByRole('link', { name: 'Nhận tư vấn' })).toHaveAttribute('href', '/gioi-thieu?loai=xem-demo#lien-he')
  expect(screen.getByRole('link', { name: 'Xem bảng giá' })).toHaveAttribute('href', '/bang-gia')

  // Khung 3D còn xa khung nhìn: chỉ có ảnh tĩnh của sân kho, chưa nạp bộ máy 3D, chưa tính chuyến mẫu
  await new Promise((resolve) => setTimeout(resolve, 50))
  expect({ viewer: stage.viewer, optimizer: stage.optimizer }).toEqual({ viewer: 0, optimizer: 0 })
  expect(screen.queryByRole('figure', { name: 'Chuyến mẫu' })).not.toBeInTheDocument()
})

test('once the stage gate opens, the 3D chunk loads while the optimizer runs the sample trip', async () => {
  stage.gate = 'go'
  renderHero()
  await waitFor(() => {
    expect(stage.viewer).toBe(1)
    expect(stage.optimizer).toBe(1)
  })
  expect(screen.getByRole('figure', { name: 'Chuyến mẫu' })).toBeInTheDocument()
})
