import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { PlannerErrorBoundary } from './PlannerErrorBoundary'

function Broken(): never {
  throw new Error('scene build failed')
}

afterEach(() => vi.restoreAllMocks())

test('lỗi lúc vẽ Planner hiện màn lỗi của Planner kèm lối về Chi tiết chuyến, không làm trắng trang', () => {
  // React vẫn in lỗi đã bắt ra console: tắt để kết quả test gọn
  vi.spyOn(console, 'error').mockImplementation(() => {})
  render(
    <I18nProvider>
      <MemoryRouter>
        <PlannerErrorBoundary tripId="TRIP-0007"><Broken /></PlannerErrorBoundary>
      </MemoryRouter>
    </I18nProvider>,
  )
  expect(screen.getByRole('heading', { name: 'Không mở được phương án 3D' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về Chi tiết chuyến' })).toHaveAttribute('href', '/chuyen/TRIP-0007')
  expect(screen.getByRole('button', { name: 'Tải lại trang' })).toBeInTheDocument()
})

test('không lỗi thì vẽ nguyên nội dung', () => {
  render(
    <I18nProvider>
      <MemoryRouter>
        <PlannerErrorBoundary tripId="TRIP-0007"><p>Khung 3D</p></PlannerErrorBoundary>
      </MemoryRouter>
    </I18nProvider>,
  )
  expect(screen.getByText('Khung 3D')).toBeInTheDocument()
})
