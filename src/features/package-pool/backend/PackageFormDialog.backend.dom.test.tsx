import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'
import { PackageFormDialog } from './PackageFormDialog'
import type { CargoPackage } from './packages-api'

/**
 * Sửa kiện khi `packages` nối backend: `PUT /api/packages/{id}` không cần yêu cầu giao (ô đó chỉ có ở form thêm kiện), giữ nguyên đơn của
 * kiện (máy chủ gán lại `orderId` theo thân gửi), và máy chủ từ chối thì form nói ra thay vì im lặng.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

const PACKAGE_DTO = {
  id: 5, orderId: 42, packageTypeId: null, deliveryRequirementId: 7, customerName: null, receivedPackageCount: null, expectedPackageCount: null,
  packageCode: 'LB-0005', trackingBarcode: null, qrToken: 'qr-5', actualLength: 60, actualWidth: 40, actualHeight: 30, actualWeightKg: 12.5,
  handlingClass: 'STANDARD', destination: '12 Lê Lợi, Quận 1', status: 'PENDING', flag: null, isPinned: false, packageName: 'Tủ lạnh', note: null,
  orientation: null, uprightOnly: null, fragilityLevel: null, stackable: null, maxTopLoadKg: null, maxLayers: null, minSupportRatio: null,
  priority: null, mustLoad: null, packingGroup: null,
}

const EDIT_PACKAGE: CargoPackage = {
  id: '5', orderId: '42', packageTypeId: undefined, deliveryRequirementId: '7', customerName: null, receivedPackageCount: null,
  expectedPackageCount: null, packageCode: 'LB-0005', trackingBarcode: null, qrToken: 'qr-5', lengthCm: 60, widthCm: 40, heightCm: 30,
  weightKg: 12.5, handlingClass: 'STANDARD', destination: '12 Lê Lợi, Quận 1', status: 'PENDING', flag: null, isPinned: false,
  packageName: 'Tủ lạnh', note: null, orientation: null, uprightOnly: null, fragilityLevel: null, stackable: null, maxTopLoadKg: null,
  maxLayers: null, minSupportRatio: null, priority: null, mustLoad: null, packingGroup: null,
}

const NO_TYPES = { success: true, data: [], page: 0, size: 100, totalElements: 0, totalPages: 0, last: true }

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderEdit(onUpdated = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <PackageFormDialog editPackage={EDIT_PACKAGE} onClose={vi.fn()} onDone={vi.fn()} onUpdated={onUpdated} />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return onUpdated
}

test('sửa kiện: gửi PUT không kèm yêu cầu giao, giữ đơn của kiện', async () => {
  const backend = stubBackend({
    'GET /api/package-types': { body: NO_TYPES },
    'PUT /api/packages/5': { body: envelope({ ...PACKAGE_DTO, packageName: 'Tủ lạnh lớn' }) },
  })
  const onUpdated = renderEdit()
  const user = userEvent.setup()

  const name = screen.getByRole('textbox', { name: 'Tên kiện' })
  await user.clear(name)
  await user.type(name, 'Tủ lạnh lớn')
  const save = screen.getByRole('button', { name: 'Lưu thay đổi' })
  await vi.waitFor(() => expect(save).toBeEnabled())
  await user.click(save)

  await vi.waitFor(() => expect(onUpdated).toHaveBeenCalledOnce())
  expect(onUpdated.mock.calls[0]?.[0]).toMatchObject({ id: '5', packageName: 'Tủ lạnh lớn' })
  const put = backend.calls.find((call) => call.method === 'PUT')
  expect(put?.path).toBe('/api/packages/5')
  expect(put?.body).toMatchObject({ orderId: 42, packageName: 'Tủ lạnh lớn', quantity: 1, actualWeightKg: 12.5 })
  expect(put?.body).not.toHaveProperty('deliveryRequirementId')
})

test('sửa kiện: máy chủ từ chối thì form hiện câu lỗi, không báo xong', async () => {
  stubBackend({
    'GET /api/package-types': { body: NO_TYPES },
    'PUT /api/packages/5': { status: 409, body: { success: false, code: 'PACKAGE_FLAGGED', message: 'flagged' } },
  })
  const onUpdated = renderEdit()
  const user = userEvent.setup()

  const save = screen.getByRole('button', { name: 'Lưu thay đổi' })
  await vi.waitFor(() => expect(save).toBeEnabled())
  await user.click(save)

  expect(await screen.findByText(/gỡ cờ/)).toBeInTheDocument()
  expect(onUpdated).not.toHaveBeenCalled()
})
