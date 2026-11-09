import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend, type FakeCall } from '@/test/fake-backend'
import { signedInAs } from '@/test/signed-in'
import { MissingPackagesCard } from './MissingPackagesCard'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['warehouse']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'warehouse',
}))

/**
 * Thẻ "Kiện kho báo thiếu" của Chi tiết chuyến máy chủ: đọc và quyết qua `/api/trips/{id}/staging-shortages`. Máy chủ giả bỏ báo thiếu
 * đã quyết khỏi danh sách chờ như máy chủ thật.
 */
let open: { id: number; packageId: number; packageCode: string | null; trackingBarcode: string; packageName: string }[]
let calls: FakeCall[]

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
  open = [
    { id: 5, packageId: 11, packageCode: null, trackingBarcode: 'LB-PK-0007', packageName: 'Thùng dầu ăn 12 chai' },
    { id: 6, packageId: 12, packageCode: 'DH-778', trackingBarcode: 'LB-PK-0008', packageName: 'Thùng nước mắm' },
  ]
  const decide = (id: number) => () => {
    open = open.filter((row) => row.id !== id)
    return { body: envelope({ id, status: 'RESOLVED' }) }
  }
  calls = stubBackend({
    'GET /api/trips/1/staging-shortages': () => ({
      body: envelope(open.map((row) => ({ ...row, stopSequence: 2, status: 'OPEN', reportedByName: 'Lê Văn Kho', reportedAt: '2026-11-06 09:15:00' }))),
    }),
    'POST /api/trips/1/staging-shortages/5/resolve': decide(5),
    'POST /api/trips/1/staging-shortages/6/resolve': decide(6),
  }).calls
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderCard(role: 'dispatcher' | 'companyManager') {
  signedInAs(role)
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MissingPackagesCard tripId="1" server />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return userEvent.setup()
}

const card = () => within(screen.getByRole('region', { name: 'Kiện kho báo thiếu' }))

test('điều phối viên cho kho tìm tiếp một kiện và bỏ một kiện khỏi chuyến; máy chủ ghi, thẻ đọc lại rồi ẩn', async () => {
  const user = renderCard('dispatcher')
  expect(await screen.findByText('2 chờ quyết')).toBeInTheDocument()
  // Mã đứng đầu là mã in trên nhãn: mã của bên gửi, không có thì mã vạch
  expect(card().getByText('LB-PK-0007')).toBeInTheDocument()
  expect(card().getByText('DH-778')).toBeInTheDocument()
  expect(card().getAllByText('Điểm 2')).toHaveLength(2)
  expect(card().getAllByText(/Lê Văn Kho báo lúc 09:15/)).toHaveLength(2)

  await user.click(card().getByRole('button', { name: 'Tìm tiếp kiện LB-PK-0007' }))
  expect(await screen.findByText('1 chờ quyết')).toBeInTheDocument()

  await user.click(card().getByRole('button', { name: 'Bỏ kiện DH-778 khỏi chuyến' }))
  await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Bỏ kiện' }))
  await waitFor(() => expect(screen.queryByRole('region', { name: 'Kiện kho báo thiếu' })).not.toBeInTheDocument())
  expect(calls.filter((call) => call.method === 'POST').map((call) => [call.path, call.body])).toStrictEqual([
    ['/api/trips/1/staging-shortages/5/resolve', { decision: 'KEEP_SEARCHING' }],
    ['/api/trips/1/staging-shortages/6/resolve', { decision: 'DROP' }],
  ])
})

test('quản lý công ty chỉ xem: không có nút quyết, một dòng lý do', async () => {
  renderCard('companyManager')
  expect(await screen.findByText('2 chờ quyết')).toBeInTheDocument()
  expect(card().queryByRole('button')).not.toBeInTheDocument()
  expect(card().getByText('Chỉ điều phối viên quyết được kiện kho báo thiếu.')).toBeInTheDocument()
})
