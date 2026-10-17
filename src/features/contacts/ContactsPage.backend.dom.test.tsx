import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { ContactsPage } from './ContactsPage'

/**
 * Màn Liên hệ của khách khi nhóm `contacts` nối backend, người xem là Hỗ trợ khách hàng: danh sách, tên gói và người nhận việc đến từ
 * backend; lưu gửi `PATCH` đúng ba trường backend nhận; backend chưa bỏ được người nhận việc nên "Chưa ai nhận" mờ khi yêu cầu đã giao.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['contacts']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'contacts',
}))

const SLOW = { timeout: 5000 }

const CONTACT = {
  id: 6, fullName: 'QA Khách mới', email: 'qa.khach@example.com', phoneNumber: null, companyName: 'QA Vận tải', interestedPlanId: 2,
  interestedPlanName: 'Pro', assignedToId: null, assignedToName: null, message: 'Cần báo giá', requestType: 'PRICING', status: 'NEW',
  note: null, createdAt: '2026-10-17T07:18:15.346127900Z', resolvedAt: null,
}
const TAKEN = {
  ...CONTACT, id: 2, fullName: 'QA Khách đã giao', interestedPlanId: null, interestedPlanName: null, assignedToId: 3,
  assignedToName: 'Đinh Quang Huy', requestType: 'DEMO_REQUEST', status: 'IN_PROGRESS', createdAt: '2026-10-16T02:00:00Z',
}
const ME = {
  id: 4, keycloakId: 'kc-4', username: 'hotro@loadmaster.vn', email: 'hotro@loadmaster.vn', fullName: 'Tạ Thị Ngọc Ánh', phoneNumber: null,
  companyId: null, userRoleType: 'SYSTEM_SUPPORTER', status: 'ACTIVE',
}

type Call = { readonly method: string; readonly path: string; readonly body: unknown }
let calls: Call[] = []

beforeEach(() => {
  calls = []
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const method = init.method ?? 'GET'
    const path = input.replace('http://be.test', '')
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ method, path, body })
    const json = (data: unknown) => Promise.resolve(new Response(JSON.stringify(data), { status: 200 }))
    if (path === '/api/users/me') return json({ success: true, message: 'ok', data: ME })
    if (method === 'GET' && path === '/api/contact-guests') return json([CONTACT, TAKEN])
    if (method === 'PATCH' && path === '/api/contact-guests/6') {
      return json({ ...CONTACT, status: 'IN_PROGRESS', assignedToId: 4, assignedToName: 'Tạ Thị Ngọc Ánh', note: 'Đã gửi báo giá' })
    }
    return Promise.resolve(new Response(JSON.stringify({ success: false, message: 'không có' }), { status: 404 }))
  })
})

afterEach(() => vi.unstubAllGlobals())

function renderContacts(search: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs('systemSupporter')
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[`/lien-he-khach${search}`]}>
            <ContactsPage />
          </MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('rows come from the backend with the plan name it sends; saving sends status, the backend id of the assignee and the note', async () => {
  const user = userEvent.setup()
  renderContacts('?lien-he=6')
  expect(await screen.findByText('2 yêu cầu · 1 mới', {}, SLOW)).toBeInTheDocument()
  const panel = await screen.findByRole('region', { name: 'QA Khách mới' }, SLOW)
  expect(panel).toHaveTextContent('Pro')

  await user.click(within(panel).getByRole('combobox', { name: 'Trạng thái' }))
  await user.click(await screen.findByRole('option', { name: 'Đang xử lý' }))
  await user.click(within(panel).getByRole('combobox', { name: 'Người nhận việc' }))
  // Hỗ trợ khách hàng không đọc được danh sách người dùng của backend: chỉ nhận việc cho chính mình
  expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toStrictEqual(['Chưa ai nhận', 'Tạ Thị Ngọc Ánh · Hỗ trợ khách hàng'])
  await user.click(screen.getByRole('option', { name: 'Tạ Thị Ngọc Ánh · Hỗ trợ khách hàng' }))
  await user.type(within(panel).getByRole('textbox', { name: 'Ghi chú nội bộ' }), 'Đã gửi báo giá')
  await user.click(within(panel).getByRole('button', { name: 'Lưu thay đổi' }))

  await waitFor(() => expect(calls.filter((call) => call.method === 'PATCH')).toStrictEqual([
    { method: 'PATCH', path: '/api/contact-guests/6', body: { status: 'IN_PROGRESS', assignedToId: 4, note: 'Đã gửi báo giá' } },
  ]))
  expect(calls.some((call) => call.path.startsWith('/api/users?') || call.path.startsWith('/api/subscription'))).toBe(false)
})

test('a request someone already took cannot go back to nobody: the option is dimmed and the field says why', async () => {
  const user = userEvent.setup()
  renderContacts('?lien-he=2')
  const panel = await screen.findByRole('region', { name: 'QA Khách đã giao' }, SLOW)
  const assignee = within(panel).getByRole('combobox', { name: 'Người nhận việc' })
  expect(assignee).toHaveAccessibleDescription('Yêu cầu đã có người nhận thì chỉ đổi được sang người khác, chưa để trống lại được.')
  await user.click(assignee)
  expect(await screen.findByRole('option', { name: 'Chưa ai nhận' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('option', { name: 'Đinh Quang Huy' })).toHaveAttribute('aria-disabled', 'true')
  expect(screen.getByRole('option', { name: 'Tạ Thị Ngọc Ánh · Hỗ trợ khách hàng' })).not.toHaveAttribute('aria-disabled')
})
