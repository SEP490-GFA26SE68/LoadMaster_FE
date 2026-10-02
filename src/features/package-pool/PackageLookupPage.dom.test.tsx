import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { Toaster } from 'sonner'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { PackageLookupPage } from './PackageLookupPage'

/**
 * Tra cứu kiện `/tra-cuu-kien` (FE-3b-06) trên kho mock thật, seed neo 14/09/2026: `PK-0063` (`BV-VIN-2609-05`) và kiện kho báo thiếu
 * của chuyến TRIP-003 `PK-T00739` mang cờ "Không tìm thấy"; `PK-PN-0005` là kiện của Phương Nam. Các test dùng chung kho và chạy theo
 * thứ tự: hai test cuối (nhân viên kho) gỡ cờ.
 */
const SLOW = { timeout: 5000 }

function UrlProbe() {
  const location = useLocation()
  return <output data-testid="url">{location.pathname + location.search}</output>
}

function renderLookup(role: Role, path = '/tra-cuu-kien') {
  const router = createMemoryRouter(
    [{ path: '/tra-cuu-kien', element: <><PackageLookupPage /><UrlProbe /></> }, { path: '*', element: <UrlProbe /> }],
    { initialEntries: [path] },
  )
  signedInAs(role)
  const view = render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <RouterProvider router={router} />
          <Toaster />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return { user: userEvent.setup(), container: view.container }
}

async function lookUp(user: ReturnType<typeof userEvent.setup>, code: string) {
  const input = screen.getByRole('textbox', { name: 'Mã QR hoặc mã kiện của bên gửi' })
  await user.clear(input)
  await user.type(input, code)
  await user.click(screen.getByRole('button', { name: 'Tra cứu' }))
}

const facts = (card: HTMLElement) =>
  Object.fromEntries(within(card).getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]))

test('the dispatcher types a sender code and gets the package: every field, the flag, and the actions of the role', async () => {
  const { user, container } = renderLookup('dispatcher')
  expect(await screen.findByText('Quét hoặc nhập mã để xem kiện')).toBeInTheDocument()
  // Một nút chính trên màn: Quét mã QR
  expect([...container.querySelectorAll('button.text-on-primary, a.text-on-primary')].map((node) => node.textContent)).toStrictEqual(['Quét mã QR'])
  await user.click(screen.getByRole('button', { name: 'Tra cứu' }))
  expect(await screen.findByText('Nhập mã trước khi tra cứu.')).toBeInTheDocument()

  await lookUp(user, 'bv-vin-2609-05')
  const card = await screen.findByRole('region', { name: 'Kiện BV-VIN-2609-05' }, SLOW)
  expect(screen.getByTestId('url')).toHaveTextContent('/tra-cuu-kien?ma=bv-vin-2609-05')
  const token = (await getMockDb().getPackage('PK-0063')).qrToken
  expect(facts(card)).toStrictEqual({
    'Mã của kho kiện': 'PK-0063', 'Mã của bên gửi': 'BV-VIN-2609-05', 'Mã QR': token, 'Kích thước (D × R × C)': '80 × 60 × 50 cm', 'Khối lượng': '32 kg',
    'Loại hàng': 'Thường', 'Điểm đến': 'KCN Bắc Vinh, TP. Vinh, Nghệ An', 'Chuyến': 'Chưa vào chuyến nào',
  })
  expect(within(card).getByRole('heading', { level: 2, name: 'BV-VIN-2609-05' })).toBeInTheDocument()
  expect(within(card).getByText('Đã nhập')).toBeInTheDocument()
  expect(within(card).getByText('Không tìm thấy')).toBeInTheDocument()
  expect(within(card).getByRole('img', { name: `Mã QR ${token}` })).toBeInTheDocument()
  // In lại nhãn giữ mã kiện; điều phối viên gỡ cờ và mở kiện ở Kho kiện, không có nút "đã tìm thấy" của kho
  expect(within(card).getByRole('link', { name: 'In lại nhãn' })).toHaveAttribute('href', '/kien-hang/nhan?kien=PK-0063&tu=tra-cuu')
  expect(within(card).getByRole('link', { name: 'Mở trong Kho kiện' })).toHaveAttribute('href', '/kien-hang?q=PK-0063')
  expect(within(card).getByRole('button', { name: 'Gỡ cờ Không tìm thấy' })).toBeInTheDocument()
  expect(within(card).queryByRole('button', { name: 'Đã tìm thấy kiện này' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: 'Về màn kho' })).not.toBeInTheDocument()
})

test('a code that matches nothing and a code of another company read exactly the same: not found, no data', async () => {
  // Đọc kiện của Phương Nam khi kho chưa có phiên (không lọc); màn mở sau đó đăng nhập lại điều phối viên Long Bình
  getMockDb().restoreSession(null)
  const foreign = await getMockDb().getPackage('PK-PN-0005')
  const { user } = renderLookup('dispatcher', '/tra-cuu-kien?ma=LM-0000-0000-0000')
  expect(await screen.findByText('Không có kiện nào của công ty bạn mang mã LM-0000-0000-0000. Xem lại mã in trên nhãn.', {}, SLOW)).toBeInTheDocument()
  expect(screen.getByText('Không tìm thấy')).toBeInTheDocument()
  for (const code of [foreign.qrToken, foreign.packageCode, foreign.id]) {
    await lookUp(user, code)
    expect(await screen.findByText(`Không có kiện nào của công ty bạn mang mã ${code}. Xem lại mã in trên nhãn.`, {}, SLOW)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /^Kiện / })).not.toBeInTheDocument()
    expect(screen.queryByText(foreign.destination)).not.toBeInTheDocument()
  }
})

test('a package in a trip shows its trip and stop; a sender code shared by several packages lists them to choose from', async () => {
  const [label] = await getMockDb().listTripLabels('TRIP-2026-0914')
  const { user } = renderLookup('dispatcher', `/tra-cuu-kien?ma=${label?.qrToken}`)
  const card = await screen.findByRole('region', { name: 'Kiện PKG-001-01' }, SLOW)
  const stop = (await getMockDb().getTrip('TRIP-2026-0914')).stops[0]
  expect(within(card).getByText('Đã gán chuyến')).toBeInTheDocument()
  expect(within(card).getByRole('link', { name: 'TRIP-2026-0914' })).toHaveAttribute('href', '/chuyen/TRIP-2026-0914')
  expect(facts(card)['Điểm giao']).toBe(`Điểm 1 · ${stop?.name}`)
  expect(facts(card)['Cờ']).toBe('Không có cờ')

  // 13 chuyến của Long Bình có kiện mang mã PKG-001-01
  await lookUp(user, 'PKG-001-01')
  const list = await screen.findByRole('region', { name: '13 kiện mang mã PKG-001-01' }, SLOW)
  const choices = within(list).getAllByRole('button')
  expect(choices).toHaveLength(13)
  expect(within(list).getByRole('button', { name: `Xem kiện ${label?.poolPackageId}` })).toHaveTextContent('TRIP-2026-0914')
  await user.click(within(list).getByRole('button', { name: `Xem kiện ${label?.poolPackageId}` }))
  const picked = await screen.findByRole('region', { name: 'Kiện PKG-001-01' }, SLOW)
  expect(facts(picked)['Mã của kho kiện']).toBe(label?.poolPackageId)
  expect(screen.getByTestId('url')).toHaveTextContent(`/tra-cuu-kien?ma=PKG-001-01&kien=${label?.poolPackageId}`)
  await user.click(within(picked).getByRole('button', { name: 'Về danh sách kiện cùng mã' }))
  expect(await screen.findByRole('region', { name: '13 kiện mang mã PKG-001-01' }, SLOW)).toBeInTheDocument()
})

test('the warehouse works on touch targets; typing the code of a flagged package offers "I found it", which clears the flag and tells the dispatcher', async () => {
  const { user } = renderLookup('warehouse')
  await screen.findByText('Quét hoặc nhập mã để xem kiện')
  // Nút 56 px, ô nhập 56 px chữ 16 px, và lối về màn kho
  for (const name of ['Tra cứu', 'Quét mã QR']) expect(screen.getByRole('button', { name })).toHaveClass('h-14', 'text-body-lg')
  expect(screen.getByRole('textbox', { name: 'Mã QR hoặc mã kiện của bên gửi' })).toHaveClass('h-14', 'text-body-lg')
  expect(screen.getByRole('link', { name: 'Về màn kho' })).toHaveAttribute('href', '/kho')
  expect(screen.getByRole('link', { name: 'Về màn kho' })).toHaveClass('h-14')

  await lookUp(user, 'BV-VIN-2609-05')
  const card = await screen.findByRole('region', { name: 'Kiện BV-VIN-2609-05' }, SLOW)
  expect(within(card).getByRole('link', { name: 'In lại nhãn' })).toHaveClass('h-14')
  // Nhân viên kho không gỡ cờ như điều phối viên, không mở Kho kiện
  expect(within(card).queryByRole('button', { name: /^Gỡ cờ/ })).not.toBeInTheDocument()
  expect(within(card).queryByRole('link', { name: 'Mở trong Kho kiện' })).not.toBeInTheDocument()
  expect(within(card).getByText('Kiện này đang mang cờ "Không tìm thấy". Nếu kiện đang ở trước mặt bạn, xác nhận để gỡ cờ.')).toBeInTheDocument()
  const events = (await getMockDb().listEvents()).length

  await user.click(within(card).getByRole('button', { name: 'Đã tìm thấy kiện này' }))
  expect(await within(card).findByText('Đã gỡ cờ "Không tìm thấy" của kiện BV-VIN-2609-05. Điều phối viên thấy việc này ở chuông thông báo.', {}, SLOW)).toBeInTheDocument()
  await waitFor(() => expect(within(card).queryByRole('button', { name: 'Đã tìm thấy kiện này' })).not.toBeInTheDocument(), SLOW)
  expect((await getMockDb().getPackage('PK-0063')).flags).toStrictEqual([])
  const log = await getMockDb().listEvents()
  expect(log).toHaveLength(events + 1)
  expect(log[0]).toMatchObject({ action: 'package.found', actorId: 'US-0003', target: { type: 'package', id: 'PK-0063' } })
})

test('the warehouse scanning a flagged package clears the flag at once; a code that is no package is explained in the dialog', async () => {
  const flagged = await getMockDb().getPackage('PK-T00739')
  expect(flagged.flags).toStrictEqual(['NOT_FOUND'])
  const { user } = renderLookup('warehouse')
  await screen.findByText('Quét hoặc nhập mã để xem kiện')
  await user.click(screen.getByRole('button', { name: 'Quét mã QR' }))
  const dialog = within(await screen.findByRole('dialog', { name: 'Quét mã QR của kiện' }))
  // jsdom không có camera: nhập mã in dưới hình QR
  await user.type(dialog.getByRole('textbox', { name: 'Nhập mã' }), 'LM-0000-0000-0000')
  await user.click(dialog.getByRole('button', { name: 'Xác nhận mã' }))
  expect(await dialog.findByRole('alert', {}, SLOW)).toHaveTextContent('Không có kiện nào của công ty bạn mang mã LM-0000-0000-0000. Xem lại mã in trên nhãn.')

  await user.clear(dialog.getByRole('textbox', { name: 'Nhập mã' }))
  await user.type(dialog.getByRole('textbox', { name: 'Nhập mã' }), flagged.qrToken.toLowerCase())
  await user.click(dialog.getByRole('button', { name: 'Xác nhận mã' }))
  const card = await screen.findByRole('region', { name: 'Kiện PKG-003-12' }, SLOW)
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), SLOW)
  expect(screen.getByTestId('url')).toHaveTextContent(`/tra-cuu-kien?ma=${flagged.qrToken}`)
  expect(within(card).getByText('Đã gỡ cờ "Không tìm thấy" của kiện PKG-003-12. Điều phối viên thấy việc này ở chuông thông báo.')).toBeInTheDocument()
  await waitFor(() => expect(facts(card)['Cờ']).toBe('Không có cờ'), SLOW)
  expect((await getMockDb().getPackage('PK-T00739')).flags).toStrictEqual([])
  expect((await getMockDb().listEvents())[0]).toMatchObject({ action: 'package.found', actorId: 'US-0003', target: { id: 'PK-T00739' } })
})
