import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import { DriverStopHeader } from '@/features/driver/DriverStopHeader'
import { I18nProvider } from '@/lib/i18n'

const auth = vi.hoisted(() => ({
  user: { id: 'US-0005', fullName: 'Trần Văn Bình', email: 'taixe@longbinh.vn', role: 'driver' as const, status: 'active' as const },
  signOut: () => {},
  refreshUser: () => {},
}))

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => auth,
  useAuthSafe: () => auth,
}))

/** Kho mẫu (nhóm `assistant` chưa nối máy chủ): thanh của màn cảm ứng không có nút trợ lý (D-20), các điều khiển khác giữ nguyên. */
test('no assistant button on the touch bar while the assistant group is not on the server', () => {
  render(
    <I18nProvider>
      <MemoryRouter initialEntries={['/tai-xe/diem-giao?chuyen=TRIP-2026-0914']}>
        <DriverStopHeader stop={{ number: 1 }} stops={[{ number: 1 }, { number: 2 }]} completedStops={new Set()} />
      </MemoryRouter>
    </I18nProvider>,
  )
  expect(screen.getByRole('banner')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Trợ lý AI' })).not.toBeInTheDocument()
  expect(document.querySelector('[data-touch-assistant]')).toBeNull()
})
