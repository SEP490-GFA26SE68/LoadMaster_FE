import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { ManualConfirmCard } from './ManualConfirmCard'

vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['driver']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'driver',
}))

/**
 * Thẻ "Xác nhận tay chờ duyệt" của Chi tiết chuyến máy chủ: đọc, duyệt, từ chối qua `/api/trips/{id}/manual-confirmations`. Máy chủ giả bỏ
 * xác nhận đã xử lý khỏi danh sách chờ như máy chủ thật.
 */
type Reply = { readonly status?: number; readonly body: unknown }
const ok = (data: unknown): Reply => ({ body: { success: true, message: 'ok', data } })

let pending: { id: number; packageId: number; trackingBarcode: string; packageName: string; reason: string; note: string | null }[]
let posts: [string, unknown][]

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
  posts = []
  pending = [
    { id: 3, packageId: 11, trackingBarcode: 'LB-PK-0007', packageName: 'Thùng dầu ăn 12 chai', reason: 'QR_UNREADABLE', note: null },
    { id: 4, packageId: 12, trackingBarcode: 'LB-PK-0008', packageName: 'Thùng nước mắm', reason: 'LABEL_DAMAGED', note: 'Nhãn rách một nửa' },
  ]
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const url = new URL(input)
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    let reply: Reply = { status: 500, body: { success: false, message: 'không có route giả' } }
    const decided = /^\/api\/trips\/1\/manual-confirmations\/(\d+)\/(approve|reject)$/.exec(url.pathname)
    if (init.method === 'POST' && decided) {
      posts.push([url.pathname, body])
      pending = pending.filter((entry) => entry.id !== Number(decided[1]))
      reply = ok({ id: Number(decided[1]) })
    } else if (url.pathname === '/api/trips/1/manual-confirmations') {
      reply = ok(pending.map((entry) => ({ ...entry, stopSequence: 2, packageCode: null, requestedByName: 'Trần Văn Bình', requestedAt: '2026-10-17T14:25:00' })))
    }
    return Promise.resolve({ ok: (reply.status ?? 200) < 400, status: reply.status ?? 200, text: () => Promise.resolve(JSON.stringify(reply.body)) })
  })
  return () => vi.unstubAllGlobals()
})

function renderCard() {
  signedInAs('dispatcher')
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <ManualConfirmCard tripId="1" server />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return userEvent.setup()
}

const card = () => within(screen.getByRole('region', { name: 'Xác nhận tay chờ duyệt' }))

test('điều phối viên duyệt một xác nhận tay và từ chối một cái kèm lý do; máy chủ ghi, thẻ đọc lại', async () => {
  const user = renderCard()
  expect(await screen.findByText('2 chờ duyệt')).toBeInTheDocument()
  expect(card().getAllByText(/Trần Văn Bình/)).toHaveLength(2)

  await user.click(card().getByRole('button', { name: 'Duyệt xác nhận tay LB-PK-0007' }))
  await waitFor(() => expect(posts).toStrictEqual([['/api/trips/1/manual-confirmations/3/approve', undefined]]))
  expect(await screen.findByText('1 chờ duyệt')).toBeInTheDocument()

  await user.click(card().getByRole('button', { name: 'Từ chối xác nhận tay LB-PK-0008' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Từ chối xác nhận tay LB-PK-0008?' }))
  await user.type(dialog.getByRole('textbox', { name: 'Lý do từ chối' }), 'Ảnh chụp cho thấy sai kiện')
  await user.click(dialog.getByRole('button', { name: 'Từ chối xác nhận' }))
  await waitFor(() => expect(posts.at(-1)).toStrictEqual(['/api/trips/1/manual-confirmations/4/reject', { reason: 'Ảnh chụp cho thấy sai kiện' }]))
  await waitFor(() => expect(screen.queryByText('1 chờ duyệt')).toBeNull())
})
