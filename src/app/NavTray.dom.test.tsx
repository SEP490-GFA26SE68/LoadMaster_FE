import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { NAV_ITEMS, NAV_SCREENS } from './nav-items'
import { NavTray } from './NavTray'

/** Tên mục của điều phối viên ở kho mẫu (không có "Phiếu xin chuyến" — chỉ khi nối máy chủ). */
const LABELS: Record<string, string> = {
  '/chuyen': 'Chuyến hàng',
  '/phieu-xin-chuyen': 'Phiếu xin chuyến',
  '/giam-sat': 'Giám sát',
  '/kien-hang': 'Kho kiện',
  '/yeu-cau-giao': 'Yêu cầu giao',
  '/doi-xe': 'Đội xe',
  '/tong-quan': 'Bảng điều khiển',
  '/phieu-luong': 'Phiếu lương',
}
const ITEMS = NAV_ITEMS.dispatcher.map((id) => NAV_SCREENS[id]).map(({ to, icon }) => ({ to, icon, label: LABELS[to]! }))

/**
 * jsdom không dựng bố cục: giả bề rộng của khung (`data-nav-slot`) và của bản đo — mỗi mục 100 px, nút "Thêm" 80 px, nút mang tên mục
 * đang mở 120 px. Lề và khoảng cách của khay là 0 vì jsdom không nạp CSS.
 */
let slotWidth = 300
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const measure = this.getAttribute('data-measure')
    const width = this.hasAttribute('data-nav-slot') ? slotWidth : measure === 'item' ? 100 : measure === 'more' ? 80 : measure === 'more-current' ? 120 : 0
    return DOMRect.fromRect({ width, height: 36 })
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  slotWidth = 300
})

function renderTray(path: string) {
  const router = createMemoryRouter([{ path: '*', element: <NavTray items={ITEMS} /> }], { initialEntries: [path] })
  render(
    <I18nProvider>
      <RouterProvider router={router} />
    </I18nProvider>,
  )
  return router
}

const shownLinks = () => within(screen.getByRole('navigation')).queryAllByRole('link').map((link) => link.getAttribute('aria-label'))

test('khay đủ rộng: mọi mục hiện, không có nút Thêm', () => {
  slotWidth = 2000
  renderTray('/chuyen')
  expect(shownLinks()).toStrictEqual(ITEMS.map((item) => item.label))
  expect(screen.queryByRole('button', { name: /^Thêm/ })).not.toBeInTheDocument()
})

test('khay hẹp: mục không vừa dồn vào nút Thêm, menu liệt kê đúng mục ẩn và mở được màn', async () => {
  const user = userEvent.setup()
  const router = renderTray('/chuyen')
  // 80 + 2 × 100 ≤ 300: hai mục đầu và nút Thêm
  expect(shownLinks()).toStrictEqual(['Chuyến hàng', ITEMS[1]!.label])
  const hidden = ITEMS.slice(2).map((item) => item.label)
  const more = screen.getByRole('button', { name: `Thêm ${hidden.length} mục` })
  expect(more).toHaveTextContent('Thêm')
  expect(more).not.toHaveAttribute('data-nav-current')

  await user.click(more)
  const menu = await screen.findByRole('menu')
  expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toStrictEqual(hidden)
  await user.click(within(menu).getByRole('menuitem', { name: 'Đội xe' }))
  expect(router.state.location.pathname).toBe('/doi-xe')
})

test('mục đang mở nằm trong Thêm: nút mang tên mục đó, menu đánh dấu mục đang mở', async () => {
  const user = userEvent.setup()
  renderTray('/doi-xe/VEHICLE-002')
  // Nút mang tên "Đội xe" rộng 120: 120 + 100 ≤ 300 → chỉ còn màn chính
  expect(shownLinks()).toStrictEqual(['Chuyến hàng'])
  const hiddenCount = ITEMS.length - 1
  const more = screen.getByRole('button', { name: `Thêm ${hiddenCount} mục — đang mở: Đội xe` })
  expect(more).toHaveTextContent('Đội xe')
  expect(more).toHaveAttribute('data-nav-current')

  await user.click(more)
  const menu = await screen.findByRole('menu')
  expect(within(menu).getByRole('menuitem', { name: 'Đội xe' })).toHaveAttribute('aria-current', 'page')
  expect(within(menu).getByRole('menuitem', { name: 'Giám sát' })).not.toHaveAttribute('aria-current')
  // Esc đóng menu và trả focus về nút
  await user.keyboard('{Escape}')
  expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  expect(more).toHaveFocus()
})

test('bàn phím: Enter mở menu, mũi tên đi trong menu', async () => {
  const user = userEvent.setup()
  renderTray('/chuyen')
  const more = screen.getByRole('button', { name: /^Thêm/ })
  more.focus()
  await user.keyboard('{Enter}')
  const menu = await screen.findByRole('menu')
  const items = within(menu).getAllByRole('menuitem')
  await expect.poll(() => document.activeElement).toBe(items[0])
  await user.keyboard('{ArrowDown}')
  expect(items[1]).toHaveFocus()
})
