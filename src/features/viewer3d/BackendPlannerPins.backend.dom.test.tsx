import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { expect, test, vi } from 'vitest'
import { ApiError } from '@/lib/api-client'
import { createTranslator, dataErrorMessage, I18nProvider } from '@/lib/i18n'
import { sceneBox } from '@/test/scene'
import { SelectedPackagePanel } from './panels/SelectedPackagePanel'
import type { ScenePlacement } from './scene-input'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * Planner nối backend: ghim từ thẻ kiện đang chọn (máy chủ lưu ngay, không chờ "Duyệt bản chỉnh"). "Chạy lại giữ ghim" là lần chạy ba
 * phương án ở Thiết lập tối ưu (`BackendOptimizationSetupPage.backend.dom.test.tsx`).
 */
function renderCard(placement: ScenePlacement, onToggle: (placement: ScenePlacement) => void, disabledReason?: string) {
  render(
    <MemoryRouter>
      <I18nProvider>
        <SelectedPackagePanel placement={placement} placements={[placement]} totalSteps={1} stops={[]} tripId="TRIP-42" onFocus={() => undefined}
          pin={{ pending: false, onToggle, disabledReason }} />
      </I18nProvider>
    </MemoryRouter>,
  )
  return within(screen.getByRole('complementary', { name: 'Kiện đang chọn' }))
}

test('thẻ kiện đang chọn: kiện chưa ghim có nút "Ghim", bấm là gửi kiện đó', async () => {
  const onToggle = vi.fn()
  const card = renderCard(sceneBox('PK-0007'), onToggle)
  await userEvent.click(card.getByRole('button', { name: 'Ghim' }))
  expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 'PK-0007', pinned: false }))
})

test('kiện đã ghim: chữ "Đã ghim" và nút "Bỏ ghim"', () => {
  const card = renderCard(sceneBox('PK-0008', 0, 0, 0, { pinned: true }), vi.fn())
  expect(card.getByRole('button', { name: 'Bỏ ghim' })).toBeInTheDocument()
  expect(card.getAllByText(/Đã ghim/).length).toBeGreaterThan(0)
})

test('chuyến còn Nháp: nút "Ghim" mờ, lý do ngay dưới nút; bấm không gửi gì', async () => {
  const onToggle = vi.fn()
  const card = renderCard(sceneBox('PK-0007'), onToggle, 'Chuyến còn Nháp: chỉ ghim và chạy lại được khi chuyến Đã lập kế hoạch.')
  const button = card.getByRole('button', { name: 'Ghim' })
  expect(button).toBeDisabled()
  expect(button).toHaveAccessibleDescription('Chuyến còn Nháp: chỉ ghim và chạy lại được khi chuyến Đã lập kế hoạch.')
  await userEvent.click(button)
  expect(onToggle).not.toHaveBeenCalled()
})

test('máy chủ từ chối vì chuyến đã rời Đã lập kế hoạch (409 TRIP_LOCKED): câu nói đúng lý do', () => {
  const message = dataErrorMessage(new ApiError('TRIP_LOCKED', { status: 409 }), createTranslator('vi'))
  expect(message).toBe('Chuyến không còn ở Đã lập kế hoạch nên không ghim, bỏ ghim hay chạy lại phương án được nữa. Tải lại để xem trạng thái mới.')
})
