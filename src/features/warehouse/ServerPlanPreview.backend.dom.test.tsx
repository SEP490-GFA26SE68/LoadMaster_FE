import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend } from '@/test/fake-backend'
import { PREVIEW } from './warehouse-preview-test-fixture'
import { renderWarehouse } from './warehouse-test-utils'
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['warehouse']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'warehouse',
}))
beforeEach(() => connectApiAuth(() => Promise.resolve('fixture-token')))
afterEach(() => vi.unstubAllGlobals())

test('3D route reads approved plan, selection changes guide only; no execution writes', async () => {
  const user = userEvent.setup()
  const { calls } = stubBackend({ 'GET /api/warehouse/tasks/7/plan': { body: envelope(PREVIEW) } })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await user.click(await screen.findByRole('button', { name: '#2 · PK-2 Chưa xếp' }))
  const guide = screen.getByRole('region', { name: 'Hướng dẫn vị trí và hướng đặt' })
  expect(within(guide).getByText('PK-2')).toBeInTheDocument()
  expect(within(guide).getByText('320 cm')).toBeInTheDocument() // 600-(200+80)
  expect(screen.getByText('Phiên xếp đã ghi kết quả 0 / 2 kiện.')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Hoàn tất xếp hàng' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Đối chiếu kiện' })).not.toBeInTheDocument()
  expect(calls.every((c) => c.method === 'GET' && c.path.endsWith('/plan'))).toBe(true)
})
test('refresh observes current plan change and clears old selection even when placement ID is reused', async () => {
  const user = userEvent.setup()
  let current = PREVIEW
  const { calls } = stubBackend({ 'GET /api/warehouse/tasks/7/plan': () => ({ body: envelope(current) }) })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await user.click(await screen.findByRole('button', { name: '#1 · PK-1 Chưa xếp' }))
  current = { ...PREVIEW, loadPlanId: 99, executionId: 90, status: 'IN_PROGRESS' }
  await user.click(screen.getByRole('button', { name: 'Làm mới phương án' }))
  expect(await screen.findByText(/Phương án đã thay đổi/)).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Hướng dẫn vị trí và hướng đặt' })).not.toBeInTheDocument()
  expect(screen.getByText('Phương án #99 · Phiên #90 · Đang xếp hàng')).toBeInTheDocument()
  expect(screen.getByText('Kiện cần xếp theo phiên: bước 1 · PK-1.')).toBeInTheDocument()
  expect(calls.every((c) => c.method === 'GET')).toBe(true)
})
test('stale after refresh hides cached geometry; GET retry never starts or completes', async () => {
  const user = userEvent.setup()
  let stale = false
  const { calls } = stubBackend({ 'GET /api/warehouse/tasks/7/plan': () => stale ? { status: 409, body: { success: false, code: 'PLAN_STALE' } } : { body: envelope(PREVIEW) } })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await user.click(await screen.findByRole('button', { name: '#1 · PK-1 Chưa xếp' }))
  stale = true
  await user.click(screen.getByRole('button', { name: 'Làm mới phương án' }))
  expect(await screen.findByRole('alert')).toHaveTextContent(/lỗi thời/)
  expect(screen.queryByRole('button', { name: '#1 · PK-1 Chưa xếp' })).not.toBeInTheDocument()
  expect(calls.every((c) => c.method === 'GET')).toBe(true)
})
test('negative clearances and invalid rotation are shown as warnings, never clamped', async () => {
  const user = userEvent.setup()
  stubBackend({ 'GET /api/warehouse/tasks/7/plan': { body: envelope({ ...PREVIEW, placements: [{ ...PREVIEW.placements![0], posX: 550, rotation: null }] }) } })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await user.click(await screen.findByRole('button', { name: '#1 · PK-1 Chưa xếp' }))
  const guide = within(screen.getByRole('region', { name: 'Hướng dẫn vị trí và hướng đặt' }))
  expect(guide.getByText('-30 cm')).toBeInTheDocument()
  expect(guide.getByText(/Kiện vượt giới hạn thùng/)).toBeInTheDocument()
  expect(guide.getByText(/Thiếu mã rotation hợp lệ/)).toBeInTheDocument()
})

test('geometry updates under the same plan ID clear inspection; outcome updates preserve inspection', async () => {
  const user = userEvent.setup()
  let current = { ...PREVIEW, executionId: 60, status: 'IN_PROGRESS' }
  stubBackend({ 'GET /api/warehouse/tasks/7/plan': () => ({ body: envelope(current) }) })
  renderWarehouse('/kho?chuyen=7&xem=3d')
  await user.click(await screen.findByRole('button', { name: '#2 · PK-2 Chưa xếp' }))
  current = { ...current, placements: current.placements!.map((p) => p.placementId === 71 ? { ...p, status: 'CONFIRMED' } : p) }
  await user.click(screen.getByRole('button', { name: 'Làm mới phương án' }))
  expect(await screen.findByText('Phiên xếp đã ghi kết quả 1 / 2 kiện.')).toBeInTheDocument()
  expect(screen.getByRole('region', { name: 'Hướng dẫn vị trí và hướng đặt' })).toBeInTheDocument()
  expect(screen.queryByText(/Phương án đã thay đổi/)).not.toBeInTheDocument()
  current = { ...current, placements: current.placements!.map((p) => ({ ...p, posX: 300 })) }
  await user.click(screen.getByRole('button', { name: 'Làm mới phương án' }))
  expect(await screen.findByText(/Phương án đã thay đổi/)).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Hướng dẫn vị trí và hướng đặt' })).not.toBeInTheDocument()
})
