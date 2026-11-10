import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import type { Role } from '@/types/user'
import { signedInAs } from '@/test/signed-in'
import { SupportPage } from './SupportPage'
import { SupportTicketDialog } from './SupportTicketDialog'

/**
 * Yêu cầu hỗ trợ khi nhóm `support` nối backend: trao đổi ghi trong `resolutionNote`, khung công ty đọc hợp đồng và credit của công ty;
 * ghi chú chữ thường của đội hỗ trợ vẫn hiện là phản hồi. Backend giả giữ yêu cầu trong bộ nhớ của test.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['support']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'support',
}))

const SLOW = { timeout: 5000 }

const BASE = {
  priority: 'MEDIUM', companyId: 1, companyName: 'Vận tải Long Bình', assignedToId: null, assignedToName: null, resolutionNote: null,
  resolvedAt: null, requesterEmail: null,
}
const DISPATCHER_TICKET = {
  ...BASE, id: 2, ticketCode: 'TCK-20261017-4403', subject: 'Ly thuỷ tinh dưới thùng nước', description: 'Kho phải xếp lại bằng tay.',
  category: 'ALGORITHM_ERROR', status: 'IN_PROGRESS', requesterId: 7, requesterName: 'Nguyễn Thanh Tùng', createdAt: '2026-10-16T18:05:00',
}
const ADMIN_TICKET = {
  ...BASE, id: 1, ticketCode: 'TCK-20261017-2258', subject: 'Hoá đơn tháng 10 thiếu mã số thuế', description: 'Cần xuất lại hoá đơn.',
  category: 'BILLING', status: 'OPEN', requesterId: 5, requesterName: 'Lê Thị Hạnh', createdAt: '2026-10-14T10:20:00',
  resolutionNote: 'Đã gửi lại hoá đơn qua email.',
}

type Call = { readonly key: string; readonly body: unknown }
let calls: Call[] = []
let tickets: Record<string, unknown>[] = []
let me: { id: number; userRoleType: string } = { id: 7, userRoleType: 'DISPATCHER' }

beforeEach(() => {
  calls = []
  tickets = [DISPATCHER_TICKET, ADMIN_TICKET]
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const key = `${init.method ?? 'GET'} ${input.replace('http://be.test', '')}`
    const body: unknown = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ key, body })
    const reply = (data: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify({ success: true, message: 'ok', data }), { status }))
    if (key === 'GET /api/users/me') return reply({ ...me, fullName: 'Người xem', status: 'ACTIVE' })
    if (key === 'GET /api/support-tickets') return reply(tickets)
    if (key === 'GET /api/contracts?companyId=1') return reply([])
    if (key === 'POST /api/support-tickets' && typeof body === 'object' && body !== null) {
      const created = { ...DISPATCHER_TICKET, ...body, id: 12, ticketCode: 'TCK-20261017-7777', status: 'OPEN', createdAt: '2026-10-17T09:00:00' }
      tickets = [created, ...tickets]
      return reply(created, 201)
    }
    const patched = /^PATCH \/api\/support-tickets\/(\d+)$/.exec(key)
    if (patched && typeof body === 'object' && body !== null) {
      tickets = tickets.map((ticket) => (String(ticket.id) === patched[1] ? { ...ticket, ...body } : ticket))
      return reply(tickets.find((ticket) => String(ticket.id) === patched[1]))
    }
    const unlocked = /^POST \/api\/support-tickets\/(\d+)\/unlock-trial(\?.*)?$/.exec(key)
    if (unlocked) {
      tickets = tickets.map((ticket) => (String(ticket.id) === unlocked[1] ? { ...ticket, status: 'RESOLVED' } : ticket))
      return reply({
        userId: 7,
        userEmail: 'user@test.vn',
        trialStillValid: true,
        nextAction: 'SIGN_AGREEMENT',
        ticketCode: 'TCK-20261017-9999',
        ticketStatus: 'RESOLVED',
      })
    }
    return Promise.resolve(new Response('{}', { status: 404 }))
  })
})

afterEach(() => vi.unstubAllGlobals())

function renderAs(role: Role, ui: ReactNode, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  signedInAs(role)
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
          <Toaster />
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

test('a dispatcher sees only the tickets they sent; a new ticket goes to the backend and can be answered', async () => {
  const user = userEvent.setup()
  renderAs('dispatcher', <SupportTicketDialog onClose={() => {}} />)
  const dialog = await screen.findByRole('dialog')
  const own = await within(dialog).findByRole('button', { name: 'Mở yêu cầu Ly thuỷ tinh dưới thùng nước' }, SLOW)
  expect(own).toHaveTextContent('TCK-20261017-4403')
  expect(own).toHaveTextContent('Cập nhật 16/10/2026 18:05')
  expect(own).toHaveTextContent('0 trả lời')
  // Yêu cầu của quản trị công ty cùng công ty: backend trả về, màn không hiện
  expect(within(dialog).getAllByRole('listitem')).toHaveLength(1)

  await user.click(within(dialog).getByRole('button', { name: 'Gửi yêu cầu mới' }))
  await user.type(within(dialog).getByRole('textbox', { name: 'Tiêu đề' }), 'QA không in được nhãn')
  await user.type(within(dialog).getByRole('textbox', { name: 'Mô tả' }), 'Bấm In nhãn QR thì trang trắng.')
  await user.click(within(dialog).getByRole('button', { name: 'Gửi yêu cầu' }))
  expect(await within(dialog).findByRole('heading', { name: 'QA không in được nhãn' }, SLOW)).toBeInTheDocument()
  expect(within(dialog).getByText('TCK-20261017-7777')).toBeInTheDocument()
  expect(within(dialog).getByRole('textbox', { name: 'Trả lời' })).toBeInTheDocument()
  expect(calls.find((call) => call.key === 'POST /api/support-tickets')?.body).toStrictEqual({
    subject: 'QA không in được nhãn', description: 'Bấm In nhãn QR thì trang trắng.', category: 'SYSTEM_BUG', priority: 'HIGH',
  })
})

test('the supporter reads every ticket, sees the note of the team without the company panel, and sets Resolved', async () => {
  const user = userEvent.setup()
  me = { id: 4, userRoleType: 'SYSTEM_SUPPORTER' }
  renderAs('systemSupporter', <SupportPage />, '/ho-tro?ticket=1')
  const panel = await screen.findByRole('region', { name: 'Hoá đơn tháng 10 thiếu mã số thuế' }, SLOW)
  expect(panel).toHaveTextContent('Cần xuất lại hoá đơn.')
  expect(within(panel).getByRole('region', { name: 'Phản hồi của đội hỗ trợ' })).toHaveTextContent('Đã gửi lại hoá đơn qua email.')
  expect(within(panel).getByRole('button', { name: 'Gửi trả lời' })).toBeInTheDocument()
  expect(screen.queryByRole('region', { name: 'Thông tin công ty' })).toBeNull()
  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toContain('Gửi lúc')
  expect(within(table).getAllByText('Vận tải Long Bình')).toHaveLength(2)

  await user.click(within(panel).getByRole('combobox', { name: 'Trạng thái yêu cầu' }))
  expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toStrictEqual(['Mở', 'Đang xử lý', 'Đã giải quyết', 'Đã đóng'])
  await user.click(screen.getByRole('option', { name: 'Đã giải quyết' }))
  await waitFor(() => expect(calls.filter((call) => call.key.startsWith('PATCH'))).toStrictEqual([
    { key: 'PATCH /api/support-tickets/1', body: { status: 'RESOLVED' } },
  ]))
  expect(await screen.findByText('Yêu cầu TCK-20261017-2258 chuyển sang Đã giải quyết', {}, SLOW)).toBeInTheDocument()
})

test('locks IN_PROGRESS ticket for a second supporter so they cannot change status or reply', async () => {
  tickets = [
    {
      ...DISPATCHER_TICKET,
      status: 'IN_PROGRESS',
      assignedToId: 4,
      assignedToName: 'Tạ Thị Ngọc Ánh',
    },
  ]
  me = { id: 9, userRoleType: 'SYSTEM_SUPPORTER' }
  renderAs('systemSupporter', <SupportPage />, '/ho-tro?ticket=2')

  const panel = await screen.findByRole('region', { name: 'Ly thuỷ tinh dưới thùng nước' }, SLOW)
  expect(within(panel).getByRole('combobox', { name: 'Trạng thái yêu cầu' })).toBeDisabled()
  expect(within(panel).queryByRole('textbox', { name: 'Trả lời' })).not.toBeInTheDocument()
  expect(within(panel).getByText(/Đang được xử lý bởi Tạ Thị Ngọc Ánh/i)).toBeInTheDocument()
})

test('a CLOSED ticket is dimmed and strictly read-only for both supporter and client', async () => {
  tickets = [
    {
      ...DISPATCHER_TICKET,
      status: 'CLOSED',
    },
  ]
  me = { id: 4, userRoleType: 'SYSTEM_SUPPORTER' }
  renderAs('systemSupporter', <SupportPage />, '/ho-tro?ticket=2')

  const panel = await screen.findByRole('region', { name: 'Ly thuỷ tinh dưới thùng nước' }, SLOW)
  expect(within(panel).getByRole('combobox', { name: 'Trạng thái yêu cầu' })).toBeDisabled()
  expect(within(panel).queryByRole('textbox', { name: 'Trả lời' })).not.toBeInTheDocument()
  expect(within(panel).getByText(/Phiếu hỗ trợ đã đóng \(chỉ đọc\)/i)).toBeInTheDocument()
})

test('shows unlock trial button for TRIAL_ACCOUNT_UNLOCK ticket and unlocks it', async () => {
  const user = userEvent.setup()
  const UNLOCK_TICKET = {
    ...BASE,
    id: 99,
    ticketCode: 'TCK-20261017-9999',
    subject: 'Mở khóa tài khoản dùng thử',
    description: 'Xin mở lại tài khoản để ký thỏa thuận',
    category: 'TRIAL_ACCOUNT_UNLOCK',
    status: 'OPEN',
    requesterId: 5,
    requesterName: 'Trần Văn Trial',
    createdAt: '2026-10-18T10:00:00',
  }
  tickets = [UNLOCK_TICKET]
  me = { id: 4, userRoleType: 'SYSTEM_SUPPORTER' }
  renderAs('systemSupporter', <SupportPage />, '/ho-tro?ticket=99')

  const panel = await screen.findByRole('region', { name: 'Mở khóa tài khoản dùng thử' }, SLOW)
  const unlockBtn = within(panel).getByRole('button', { name: 'Mở khóa tài khoản' })
  expect(unlockBtn).toBeInTheDocument()

  await user.click(unlockBtn)
  const dialog = await screen.findByRole('dialog')
  expect(within(dialog).getByText('Mở khóa tài khoản dùng thử')).toBeInTheDocument()

  const confirmBtn = within(dialog).getByRole('button', { name: 'Xác nhận mở khóa' })
  await user.click(confirmBtn)

  expect(await screen.findByText('Đã mở khóa tài khoản thành công.', {}, SLOW)).toBeInTheDocument()
})
