import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { toast, Toaster } from 'sonner'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { CompanyProfilePage } from './CompanyProfilePage'

/**
 * Thông tin công ty khi nối backend (`companies`): màn chỉ có ô của trường máy chủ lưu. `fetch` giả là một backend nhỏ có trạng thái,
 * làm như backend chạy ở máy (17/10/2026): `CompanyResponse` trần, PATCH chỉ lưu `companyName` và `contactEmail`.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['companies']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'companies',
}))

const SLOW = { timeout: 5000 }

const LONG_BINH = {
  id: 1, companyCode: 'LM-LOGISTICS', companyName: 'Vận tải Long Bình', taxCode: 'TAX-LM-001', billingEmail: 'qtcongty@loadmaster.vn',
  status: 'ACTIVE', createdAt: '2026-10-16T21:05:16.181480Z',
}

let company = LONG_BINH
let patches: unknown[] = []
let refusePatch = false

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status })

function backend(method: string, url: string, body: Record<string, unknown> | undefined): Response {
  if (url !== '/api/company/profile') throw new Error(`Backend giả không có ${method} ${url}`)
  if (method === 'GET') return json(company)
  if (method === 'PATCH') {
    patches.push(body)
    if (refusePatch) return json({ success: false, message: 'Access Denied' }, 403)
    company = { ...company, companyName: String(body?.companyName), billingEmail: String(body?.contactEmail) }
    return json(company)
  }
  throw new Error(`Backend giả không có ${method} ${url}`)
}

beforeEach(() => {
  company = LONG_BINH
  patches = []
  refusePatch = false
  connectApiAuth(() => Promise.resolve('token-1'))
  vi.stubGlobal('fetch', (input: string, init: RequestInit) => {
    const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined
    return Promise.resolve(backend(init.method ?? 'GET', input.replace('http://be.test', ''), body))
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  // Toast còn sống của bài trước được Toaster của bài sau phát lại (sonner phát lại toast đang mở khi đăng ký)
  toast.dismiss()
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/cong-ty']}>
          <CompanyProfilePage />
        </MemoryRouter>
        <Toaster />
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const factsOf = (identity: HTMLElement) => [...identity.querySelectorAll('dt, dd')].map((cell) => cell.textContent)

test('code, tax code, status and creation date are read only; only name and billing email have a field — no address, no phone', async () => {
  renderPage()
  const identity = await screen.findByRole('complementary', { name: 'Công ty' }, SLOW)
  expect(within(identity).getByRole('heading', { level: 2, name: 'Vận tải Long Bình' })).toBeInTheDocument()
  expect(within(identity).getByText('Đang hoạt động')).toBeInTheDocument()
  expect(factsOf(identity)).toStrictEqual(['Mã công ty', 'LM-LOGISTICS', 'Mã số thuế', 'TAX-LM-001', 'Ngày tạo', '17/10/2026'])
  expect(identity).toHaveTextContent('Mã công ty, mã số thuế và trạng thái do quản trị hệ thống LoadMaster thay đổi.')

  const form = within(screen.getByRole('region', { name: 'Thông tin chung' }))
  expect(form.getByText('Tên công ty và email thanh toán. Máy chủ chưa lưu địa chỉ hay số điện thoại của công ty.')).toBeInTheDocument()
  expect(form.getAllByRole('textbox').map((field) => field.getAttribute('name'))).toStrictEqual(['name', 'billingEmail'])
  expect(form.getByRole('textbox', { name: 'Tên công ty' })).toHaveValue('Vận tải Long Bình')
  expect(form.getByRole('textbox', { name: 'Email thanh toán' })).toHaveValue('qtcongty@loadmaster.vn')
  expect(form.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled()
})

test('saving sends the name and the billing email only, and the screen shows what the server saved', async () => {
  const user = userEvent.setup()
  renderPage()
  const form = within(await screen.findByRole('region', { name: 'Thông tin chung' }, SLOW))
  const email = form.getByRole('textbox', { name: 'Email thanh toán' })
  await user.clear(email)
  await user.type(email, 'ketoan@longbinh.vn')
  await user.click(form.getByRole('button', { name: 'Lưu thay đổi' }))

  expect(await screen.findByText('Đã lưu thông tin công ty', {}, SLOW)).toBeInTheDocument()
  expect(patches).toStrictEqual([{ companyName: 'Vận tải Long Bình', contactEmail: 'ketoan@longbinh.vn' }])
  expect(email).toHaveValue('ketoan@longbinh.vn')
  expect(form.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled()
})

test('a malformed billing email is refused before anything is sent; a refusal of the server keeps what was typed', async () => {
  const user = userEvent.setup()
  renderPage()
  const form = within(await screen.findByRole('region', { name: 'Thông tin chung' }, SLOW))
  const email = form.getByRole('textbox', { name: 'Email thanh toán' })
  await user.clear(email)
  await user.type(email, 'ketoan@')
  await user.click(form.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await form.findByText('Email chưa đúng định dạng')).toBeInTheDocument()
  expect(patches).toStrictEqual([])

  refusePatch = true
  await user.type(email, 'longbinh.vn')
  await user.click(form.getByRole('button', { name: 'Lưu thay đổi' }))
  expect(await form.findByRole('alert', {}, SLOW)).toHaveTextContent('Bạn không có quyền thực hiện thao tác này.')
  expect(patches).toStrictEqual([{ companyName: 'Vận tải Long Bình', contactEmail: 'ketoan@longbinh.vn' }])
  expect(email).toHaveValue('ketoan@longbinh.vn')
  expect(screen.queryByText('Đã lưu thông tin công ty')).not.toBeInTheDocument()
})
