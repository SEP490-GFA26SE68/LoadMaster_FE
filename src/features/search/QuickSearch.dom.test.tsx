import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { QuickSearch } from './QuickSearch'

/**
 * Tìm nhanh Ctrl+K (LM-099) qua kho dùng chung (seed neo 14/09): chuyến seed tạo theo thứ tự TRIP-2026-0914, TRIP-001…TRIP-015; chuyến
 * mẫu có kiện PKG-001; xe VEHICLE-003 là "Isuzu NQR 550 · 51C-284.19"; US-0011 là Đỗ Thị Hạnh (hanh.do@loadmaster.vn).
 */
const SLOW = { timeout: 4000 }

function Where() {
  const location = useLocation()
  return <output aria-label="route">{location.pathname + location.search}</output>
}

function renderSearch(role: Role) {
  signedInAs(role)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={['/chuyen']}>
            <QuickSearch />
            <input aria-label="Ô lọc của màn" />
            <Routes>
              <Route path="*" element={<Where />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const route = () => screen.getByRole('status', { name: 'route' })
const options = () => within(screen.getByRole('listbox', { name: 'Kết quả tìm nhanh' })).getAllByRole('option')

test('Ctrl+K opens the search; arrows move and wrap, Enter opens the trip; Esc returns focus to where it was', async () => {
  const user = userEvent.setup()
  renderSearch('dispatcher')
  expect(screen.getByRole('button', { name: 'Tìm nhanh' })).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K')

  await user.click(screen.getByRole('textbox', { name: 'Ô lọc của màn' }))
  await user.keyboard('{Control>}k{/Control}')
  const dialog = screen.getByRole('dialog', { name: 'Tìm nhanh' })
  const input = within(dialog).getByRole('combobox', { name: 'Từ khoá tìm nhanh' })
  expect(input).toHaveFocus()
  // Điều phối viên tìm thêm kho kiện và loại kiện (màn `/kien-hang`, `/loai-kien`)
  expect(within(dialog).getByText('Tìm chuyến (mã, tên, điểm giao), kiện (mã), yêu cầu giao (mã, điểm đến, địa chỉ), kho kiện (mã, mã QR, loại kiện, điểm đến), loại kiện (mã, tên) và xe (tên, biển số).')).toBeInTheDocument()

  // Esc đóng, con trỏ về ô đang gõ trước khi mở
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'Ô lọc của màn' })).toHaveFocus()

  await user.keyboard('{Meta>}k{/Meta}')
  await user.keyboard('trip-00')
  // TRIP-001 … TRIP-009 khớp, nhóm Chuyến giữ 8 dòng đầu
  const group = await screen.findByRole('group', { name: 'Chuyến' }, SLOW)
  expect(within(group).getAllByRole('option').map((option) => option.textContent?.match(/TRIP-\d+/)?.[0])).toStrictEqual([
    'TRIP-001', 'TRIP-002', 'TRIP-003', 'TRIP-004', 'TRIP-005', 'TRIP-006', 'TRIP-007', 'TRIP-008',
  ])
  // Trình đọc màn hình nghe số kết quả
  expect(screen.getByText('8 kết quả')).toHaveAttribute('role', 'status')
  // Phần khớp từ khoá được tô trong mã chuyến
  expect([...(options()[0]?.querySelectorAll('mark') ?? [])].map((mark) => mark.textContent)).toStrictEqual(['TRIP-00'])
  const combobox = screen.getByRole('combobox', { name: 'Từ khoá tìm nhanh' })
  expect(options()[0]).toHaveAttribute('aria-selected', 'true')
  expect(combobox).toHaveAttribute('aria-activedescendant', options()[0]?.id)

  await user.keyboard('{ArrowDown}')
  expect(options()[1]).toHaveAttribute('aria-selected', 'true')
  expect(combobox).toHaveAttribute('aria-activedescendant', options()[1]?.id)
  await user.keyboard('{ArrowUp}{ArrowUp}')
  expect(options()[7]).toHaveAttribute('aria-selected', 'true')
  expect(options()[7]).toHaveTextContent('Tuyến Biên Hoà – Thủ Đức – Bình Thạnh – Q.3')

  await user.keyboard('{Enter}')
  expect(route()).toHaveTextContent('/chuyen/TRIP-008')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('a package code opens its trip on that package; a trip is found by a stop name', async () => {
  const user = userEvent.setup()
  renderSearch('dispatcher')
  await user.keyboard('{Control>}k{/Control}')
  await user.keyboard('co.opmart')
  const trips = await screen.findByRole('group', { name: 'Chuyến' }, SLOW)
  expect(within(trips).getAllByRole('option')[0]).toHaveTextContent('Tuyến Q.7 – Thủ Dầu Một – Dĩ An – Biên HoàTRIP-2026-0914')

  await user.clear(screen.getByRole('combobox'))
  await user.keyboard('pkg-001')
  const packages = await screen.findByRole('group', { name: 'Kiện' }, SLOW)
  const [first] = within(packages).getAllByRole('option')
  expect(first).toHaveTextContent('PKG-001TRIP-2026-0914 · Tuyến Q.7 – Thủ Dầu Một – Dĩ An – Biên Hoà')
  await user.keyboard('{Enter}')
  expect(route()).toHaveTextContent('/chuyen/TRIP-2026-0914?kien=PKG-001')
})

test('only permitted groups: the manager does not find users and is told so', async () => {
  const user = userEvent.setup()
  renderSearch('companyManager')
  await user.click(screen.getByRole('button', { name: 'Tìm nhanh' }))
  await user.keyboard('hanh.do')
  expect(await screen.findByText('Không tìm thấy kết quả cho “hanh.do”.', {}, SLOW)).toBeInTheDocument()
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
})

test.each<Role>(['systemAdmin', 'companyAdmin'])('the %s searches users only: no trips, packages or vehicles (FE-0-01)', async (role) => {
  const user = userEvent.setup()
  renderSearch(role)
  await user.keyboard('{Control>}k{/Control}')
  expect(screen.getByText('Tìm người dùng (tên, email).')).toBeInTheDocument()
  await user.keyboard('hanh.do')
  const users = await screen.findByRole('group', { name: 'Người dùng' }, SLOW)
  expect(within(users).getByRole('option')).toHaveTextContent('Đỗ Thị HạnhUS-0011 · hanh.do@loadmaster.vn · Nhân viên kho')
  await user.keyboard('{Enter}')
  expect(route()).toHaveTextContent('/nguoi-dung?q=US-0011')

  // Biển số của VEHICLE-003 và mã chuyến seed: không còn nhóm nào để tìm
  await user.keyboard('{Control>}k{/Control}')
  await user.keyboard('51c-284')
  expect(await screen.findByText('Không tìm thấy kết quả cho “51c-284”.', {}, SLOW)).toBeInTheDocument()
  await user.clear(screen.getByRole('combobox', { name: 'Từ khoá tìm nhanh' }))
  await user.keyboard('trip-00')
  expect(await screen.findByText('Không tìm thấy kết quả cho “trip-00”.', {}, SLOW)).toBeInTheDocument()
  expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
})

test('the dispatcher finds a vehicle by its plate; a click on a result opens it', async () => {
  const user = userEvent.setup()
  renderSearch('dispatcher')
  await user.keyboard('{Control>}k{/Control}')
  await user.keyboard('51c-284')
  const vehicles = await screen.findByRole('group', { name: 'Xe' }, SLOW)
  await user.click(within(vehicles).getByRole('option', { name: /Isuzu NQR 550/ }))
  expect(route()).toHaveTextContent('/doi-xe/VEHICLE-003')
})

test.each<Role>(['systemManager', 'systemSupporter'])('the %s has nothing to search: no button, Ctrl+K does nothing', async (role) => {
  const user = userEvent.setup()
  renderSearch(role)
  expect(screen.queryByRole('button', { name: 'Tìm nhanh' })).not.toBeInTheDocument()
  await user.keyboard('{Control>}k{/Control}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('warehouse workers have nothing to search: no button, Ctrl+K does nothing', async () => {
  const user = userEvent.setup()
  renderSearch('warehouse')
  expect(screen.queryByRole('button', { name: 'Tìm nhanh' })).not.toBeInTheDocument()
  await user.keyboard('{Control>}k{/Control}')
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
})

test('the dispatcher searches the package pool and package types; shipments are no longer found (FE-0-06)', async () => {
  const user = userEvent.setup()
  renderSearch('dispatcher')
  await user.click(screen.getByRole('button', { name: 'Tìm nhanh' }))
  await user.keyboard('pk-0001')
  const packages = await screen.findByRole('group', { name: 'Kho kiện' }, SLOW)
  expect(within(packages).getByRole('option')).toHaveTextContent('PK-0001Thùng nước suối 24 chai · MP-NS24-0911-01')
  await user.keyboard('{Enter}')
  expect(route()).toHaveTextContent('/kien-hang?q=PK-0001')

  await user.keyboard('{Control>}k{/Control}')
  await user.keyboard('pt-003')
  const types = await screen.findByRole('group', { name: 'Loại kiện' }, SLOW)
  await user.click(within(types).getByRole('option', { name: /Thùng dầu ăn 12 chai/ }))
  expect(route()).toHaveTextContent('/loai-kien?q=PT-003')

  await user.keyboard('{Control>}k{/Control}')
  await user.keyboard('shp-001')
  expect(await screen.findByText('Không tìm thấy kết quả cho “shp-001”.', {}, SLOW)).toBeInTheDocument()
})

test('the company manager finds pool packages (read-only pool, FE-3b-03) but no package types', async () => {
  const user = userEvent.setup()
  renderSearch('companyManager')
  await user.click(screen.getByRole('button', { name: 'Tìm nhanh' }))
  expect(screen.getByText('Tìm chuyến (mã, tên, điểm giao), kiện (mã), yêu cầu giao (mã, điểm đến, địa chỉ), kho kiện (mã, mã QR, loại kiện, điểm đến) và xe (tên, biển số).')).toBeInTheDocument()
  await user.keyboard('pk-0001')
  const packages = await screen.findByRole('group', { name: 'Kho kiện' }, SLOW)
  await user.click(within(packages).getByRole('option'))
  expect(route()).toHaveTextContent('/kien-hang?q=PK-0001')

  await user.keyboard('{Control>}k{/Control}')
  await user.keyboard('pt-003')
  expect(await screen.findByText('Không tìm thấy kết quả cho “pt-003”.', {}, SLOW)).toBeInTheDocument()
})
