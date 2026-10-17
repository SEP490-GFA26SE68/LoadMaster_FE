import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { CompaniesPage } from './CompaniesPage'

/**
 * Màn Công ty khi nối backend (`companies`): cột theo dữ liệu backend, tạo công ty rồi tạo quản trị, tạo lại riêng quản trị khi bước sau
 * hỏng, tạm ngưng. `fetch` giả là một backend nhỏ có trạng thái, dạng phản hồi như backend chạy ở máy (17/10/2026).
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['companies']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'companies',
}))

const SLOW = { timeout: 5000 }

type Company = { id: number; companyCode: string; companyName: string; taxCode: string; billingEmail: string; status: string; createdAt: string }
type BackendUser = { id: number; email: string; fullName: string; phoneNumber: string; userRoleType: string; status: string; companyId: number | null }

let companies: Company[] = []
let users: BackendUser[] = []
let failUsersPost = false
let failContracts = false
let posts: { url: string; body: unknown }[] = []

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })
const failure = (status: number) => json({ success: false, message: 'lỗi' }, status)

function backend(method: string, url: string, body: Record<string, unknown> | undefined): Response {
  if (method === 'GET' && url.startsWith('/api/companies?')) return json({ content: companies, last: true, number: 0, totalPages: 1 })
  if (method === 'GET' && url === '/api/contracts') {
    if (failContracts) return failure(403)
    return json([{ id: 1, companyId: 1, planName: 'Pro', planTier: 'PRO', status: 'ACTIVE', startedAt: '2026-09-17T09:00:00', expiresAt: '2026-10-17T09:00:00' }])
  }
  if (method === 'GET' && url.startsWith('/api/users?')) return json({ success: true, data: users, page: 0, totalPages: 1, last: true })
  if (method === 'POST' && url === '/api/companies') {
    posts.push({ url, body })
    const created = { id: 9, companyCode: String(body?.companyCode), companyName: String(body?.companyName), taxCode: String(body?.taxCode), billingEmail: String(body?.billingEmail), status: 'ACTIVE', createdAt: '2026-10-17T02:00:00Z' }
    companies = [...companies, created]
    return json(created, 201)
  }
  if (method === 'POST' && url === '/api/users') {
    posts.push({ url, body })
    if (failUsersPost) return failure(500)
    const user = { id: 30, email: String(body?.email), fullName: String(body?.fullName), phoneNumber: String(body?.phoneNumber), userRoleType: 'ADMIN', status: 'ACTIVE', companyId: Number(body?.companyId) }
    users = [...users, user]
    return json({ success: true, data: { user, temporaryPassword: 'Tmp#QA0001' } }, 201)
  }
  const status = /^\/api\/companies\/(\d+)\/status\?status=(\w+)$/.exec(url)
  if (method === 'PATCH' && status) {
    companies = companies.map((company) => (company.id === Number(status[1]) ? { ...company, status: status[2] ?? '' } : company))
    return json(companies.find((company) => company.id === Number(status[1])))
  }
  throw new Error(`Backend giả không có ${method} ${url}`)
}

beforeEach(() => {
  companies = [
    { id: 1, companyCode: 'LM-LOGISTICS', companyName: 'Vận tải Long Bình', taxCode: 'TAX-LM-001', billingEmail: 'qtcongty@loadmaster.vn', status: 'ACTIVE', createdAt: '2026-10-16T21:05:16.181480Z' },
    { id: 2, companyCode: 'FAST-MOVE', companyName: 'Logistics Phương Nam', taxCode: 'TAX-FM-001', billingEmail: 'qtcongty@phuongnam.vn', status: 'SUSPENDED', createdAt: '2026-10-16T21:05:16.236710Z' },
  ]
  users = [
    { id: 6, email: 'qtcongty@loadmaster.vn', fullName: 'Lý Thu Hà', phoneNumber: '0901234567', userRoleType: 'ADMIN', status: 'ACTIVE', companyId: 1 },
    { id: 7, email: 'taixe@loadmaster.vn', fullName: 'Trần Văn Tài', phoneNumber: '0901234568', userRoleType: 'DRIVER', status: 'ACTIVE', companyId: 1 },
    { id: 2, email: 'quantri@loadmaster.vn', fullName: 'Võ Minh Khoa', phoneNumber: '0905678901', userRoleType: 'SYSTEM_ADMIN', status: 'ACTIVE', companyId: null },
  ]
  failUsersPost = false
  failContracts = false
  posts = []
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined
    return Promise.resolve(backend(init.method ?? 'GET', input.replace('http://be.test', ''), body))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderCompanies() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/nen-tang/cong-ty']}>
          <CompaniesPage />
        </MemoryRouter>
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

async function rowOf(name: string) {
  const table = await screen.findByRole('table', {}, SLOW)
  const row = within(table).getAllByRole('row').find((item) => item.querySelector('td')?.textContent?.includes(name))
  if (!row) throw new Error(`Không có dòng của ${name}`)
  return row
}

const cellsOf = (row: HTMLElement) => within(row).getAllByRole('cell').map((cell) => cell.textContent)

async function fillCreateForm(user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, adminEmail: string) {
  const type = (name: string, text: string) => user.type(within(dialog).getByRole('textbox', { name }), text)
  await type('Mã công ty', 'QA-BIEN-HO')
  await type('Mã số thuế', 'QA-TAX-01')
  await type('Tên công ty', 'QA Vận tải Biển Hồ')
  await type('Email thanh toán', 'ketoan@bienho.vn')
  await type('Họ tên', 'QA Hồ Thị Thu Hà')
  await type('Số điện thoại', '0931 245 678')
  await type('Email', adminEmail)
}

test('lists the server columns: billing, plan from the contract, users, company status and creation date', async () => {
  renderCompanies()
  expect(await screen.findByText('2 công ty', {}, SLOW)).toBeInTheDocument()
  expect(cellsOf(await rowOf('Long Bình'))).toStrictEqual([
    'Vận tải Long BìnhLM-LOGISTICS', 'qtcongty@loadmaster.vnMST TAX-LM-001', 'ProPro', 'Đang hoạt độngHết hạn 17/10/2026', '2', 'Đang hoạt động', '17/10/2026', '',
  ])
  expect(cellsOf(await rowOf('Phương Nam'))).toStrictEqual([
    'Logistics Phương NamFAST-MOVE', 'qtcongty@phuongnam.vnMST TAX-FM-001', 'Chưa có gói', '—', '0Chưa có quản trị', 'Tạm ngưng', '17/10/2026', '',
  ])
})

test('the create form only has the fields the server stores; a taken admin email is refused before anything is created', async () => {
  const user = userEvent.setup()
  renderCompanies()
  await screen.findByRole('table', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Tạo công ty' }))
  const dialog = await screen.findByRole('dialog')
  for (const field of ['Địa chỉ', 'Số điện thoại công ty', 'Tên kho']) expect(within(dialog).queryByRole('textbox', { name: field })).not.toBeInTheDocument()
  await fillCreateForm(user, dialog, 'TaiXe@loadmaster.vn')
  await user.click(within(dialog).getByRole('button', { name: 'Tạo công ty' }))
  expect(await within(dialog).findByText('Email này đã có tài khoản')).toBeInTheDocument()
  expect(posts).toStrictEqual([])
})

test('creating a company creates its first admin for that company and shows the temporary password once', async () => {
  const user = userEvent.setup()
  renderCompanies()
  await screen.findByRole('table', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Tạo công ty' }))
  const dialog = await screen.findByRole('dialog')
  await fillCreateForm(user, dialog, 'ha.ho@bienho.vn')
  await user.click(within(dialog).getByRole('button', { name: 'Tạo công ty' }))

  const password = await screen.findByRole('textbox', { name: 'Mật khẩu tạm' }, SLOW)
  expect(password).toHaveValue('Tmp#QA0001')
  expect(posts.map((post) => [post.url, post.body])).toStrictEqual([
    ['/api/companies', { companyCode: 'QA-BIEN-HO', companyName: 'QA Vận tải Biển Hồ', taxCode: 'QA-TAX-01', billingEmail: 'ketoan@bienho.vn' }],
    ['/api/users', { email: 'ha.ho@bienho.vn', fullName: 'QA Hồ Thị Thu Hà', phoneNumber: '0931245678', role: 'ADMIN', companyId: 9 }],
  ])
  await user.click(screen.getByRole('button', { name: 'Xong' }))
  await waitFor(() => expect(screen.getByText('3 công ty')).toBeInTheDocument())
  expect(cellsOf(await rowOf('Biển Hồ'))[4]).toBe('1')
})

test('when the admin step fails the company stays and the dialog only creates the admin again', async () => {
  const user = userEvent.setup()
  failUsersPost = true
  renderCompanies()
  await screen.findByRole('table', {}, SLOW)
  await user.click(screen.getByRole('button', { name: 'Tạo công ty' }))
  const first = await screen.findByRole('dialog')
  await fillCreateForm(user, first, 'ha.ho@bienho.vn')
  await user.click(within(first).getByRole('button', { name: 'Tạo công ty' }))

  const dialog = await screen.findByRole('dialog', { name: 'Tạo quản trị cho QA Vận tải Biển Hồ' }, SLOW)
  expect(within(dialog).getByText(/Đã tạo công ty QA Vận tải Biển Hồ nhưng chưa tạo được tài khoản quản trị/)).toBeInTheDocument()
  expect(within(dialog).getByRole('alert')).toHaveTextContent('Máy chủ gặp lỗi. Thử lại sau.')
  // Không tạo lại công ty: chỉ còn ô của quản trị, giữ chữ đã nhập
  expect(within(dialog).queryByRole('textbox', { name: 'Mã công ty' })).not.toBeInTheDocument()
  expect(within(dialog).getByRole('textbox', { name: 'Email' })).toHaveValue('ha.ho@bienho.vn')

  failUsersPost = false
  await user.click(within(dialog).getByRole('button', { name: 'Tạo quản trị' }))
  expect(await screen.findByRole('textbox', { name: 'Mật khẩu tạm' }, SLOW)).toHaveValue('Tmp#QA0001')
  expect(posts.filter((post) => post.url === '/api/companies')).toHaveLength(1)
  expect(posts.at(-1)?.body).toMatchObject({ companyId: 9, role: 'ADMIN' })
})

test('suspending says the server does not block sign-in yet, then records the status', async () => {
  const user = userEvent.setup()
  renderCompanies()
  await user.click(await within(await rowOf('Long Bình')).findByRole('button', { name: 'Thao tác với Vận tải Long Bình' }))
  await user.click(await screen.findByRole('menuitem', { name: 'Tạm ngưng công ty' }))
  const confirm = await screen.findByRole('dialog', { name: 'Tạm ngưng Vận tải Long Bình?' })
  expect(confirm).toHaveTextContent('chưa chặn đăng nhập')
  await user.click(within(confirm).getByRole('button', { name: 'Tạm ngưng' }))
  expect(await screen.findByText('Đã ghi trạng thái Tạm ngưng cho Vận tải Long Bình', {}, SLOW)).toBeInTheDocument()
  await waitFor(async () => expect(cellsOf(await rowOf('Long Bình'))[5]).toBe('Tạm ngưng'))
})

test('plans that cannot be read leave the plan columns empty with a banner, not "no plan"', async () => {
  failContracts = true
  renderCompanies()
  expect(await screen.findByText(/Chưa đọc được gói của các công ty/, {}, SLOW)).toBeInTheDocument()
  const cells = cellsOf(await rowOf('Long Bình'))
  expect(cells.slice(2, 4)).toStrictEqual(['—Chưa đọc được', '—Chưa đọc được'])
})
