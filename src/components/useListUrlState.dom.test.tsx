import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { expect, test } from 'vitest'
import { renderTripList } from '@/test/trip-list-harness'
import { useListUrlState } from './useListUrlState'

/**
 * Seam LM-085: màn danh sách ghép `FilterBar` + `DataTable` + `useListUrlState` (harness trong `src/test`), kiểm qua
 * những gì người dùng thấy và địa chỉ trên thanh URL.
 */

const url = () => screen.getByTestId('url').textContent
const bodyRows = () => within(screen.getAllByRole('rowgroup')[1]!).getAllByRole('row')
const firstCells = () => bodyRows().map((row) => within(row).getAllByRole('cell')[1]!.textContent)
const header = (name: string) => screen.getByRole('columnheader', { name })

test('sortable headers are buttons that flip direction and keep the order on the URL', async () => {
  const user = userEvent.setup()
  render(renderTripList())

  // Mặc định mới nhất trước, URL chưa ghi gì.
  expect(header('Ngày chạy')).toHaveAttribute('aria-sort', 'descending')
  expect(firstCells()[0]).toBe('TRIP-030')
  expect(within(header('Tuyến')).queryByRole('button')).toBeNull()

  await user.click(screen.getByRole('button', { name: 'Số kiện' }))
  expect(header('Số kiện')).toHaveAttribute('aria-sort', 'descending')
  expect(header('Ngày chạy')).not.toHaveAttribute('aria-sort')
  expect(firstCells()[0]).toBe('TRIP-007')
  expect(url()).toBe('/chuyen?sap-xep=-packages')

  await user.click(screen.getByRole('button', { name: 'Số kiện' }))
  expect(header('Số kiện')).toHaveAttribute('aria-sort', 'ascending')
  expect(firstCells()[0]).toBe('TRIP-013')
  expect(url()).toBe('/chuyen?sap-xep=packages')

  // Về đúng thứ tự mặc định thì URL gọn lại.
  await user.click(screen.getByRole('button', { name: 'Ngày chạy' }))
  expect(url()).toBe('/chuyen')
})

test('search ignores accents, filters combine, and a filter change goes back to page 1', async () => {
  const user = userEvent.setup()
  render(renderTripList('/chuyen?trang=2'))
  expect(screen.getByText('26–30 / 30')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Xoá lọc' })).toBeNull()

  await user.type(screen.getByRole('searchbox', { name: 'Tìm theo mã, tuyến' }), 'bien hoa')
  expect(screen.getByRole('searchbox')).toHaveValue('bien hoa')
  expect(screen.getByText('1–12 / 12')).toBeInTheDocument()
  expect(url()).toBe('/chuyen?q=bien+hoa')

  await user.click(screen.getByRole('combobox', { name: 'Trạng thái' }))
  await user.click(await screen.findByRole('option', { name: 'Nháp' }))
  expect(firstCells()).toStrictEqual(['TRIP-019', 'TRIP-016', 'TRIP-004', 'TRIP-001'])

  fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-09-10' } })
  expect(firstCells()).toStrictEqual(['TRIP-019', 'TRIP-016'])
  expect(url()).toBe('/chuyen?q=bien+hoa&trang-thai=nhap&tu=2026-09-10')
})

test('a filter with no match says so inside the table and clears everything in one click', async () => {
  const user = userEvent.setup()
  render(renderTripList('/chuyen?trang-thai=da-lap-ke-hoach&sap-xep=id'))

  await user.type(screen.getByRole('searchbox'), 'vung tau')
  expect(screen.getByRole('status')).toHaveTextContent('Không có kết quả khớp bộ lọc')
  expect(header('Mã chuyến')).toHaveAttribute('aria-sort', 'ascending')
  expect(screen.queryByText(/\/ 30/)).toBeNull()

  const inTable = within(screen.getByRole('table')).getByRole('button', { name: 'Xoá lọc' })
  await user.click(inTable)
  expect(screen.getByRole('searchbox')).toHaveValue('')
  expect(screen.getByRole('combobox', { name: 'Trạng thái' })).toHaveTextContent('Tất cả')
  expect(screen.getByText('1–25 / 30')).toBeInTheDocument()
  // Xoá lọc giữ thứ tự sắp xếp.
  expect(url()).toBe('/chuyen?sap-xep=id')
})

test('pages of 25 by default, next and previous, page size 50, all on the URL', async () => {
  const user = userEvent.setup()
  render(renderTripList())
  expect(bodyRows()).toHaveLength(25)
  expect(screen.getByText('1–25 / 30')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Trang trước' })).toHaveAttribute('aria-disabled', 'true')

  await user.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(bodyRows()).toHaveLength(5)
  expect(screen.getByText('26–30 / 30')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Trang sau' })).toHaveAttribute('aria-disabled', 'true')
  expect(url()).toBe('/chuyen?trang=2')

  await user.click(screen.getByRole('button', { name: 'Trang sau' }))
  expect(url()).toBe('/chuyen?trang=2')

  await user.click(screen.getByRole('combobox', { name: 'Số dòng mỗi trang' }))
  await user.click(await screen.findByRole('option', { name: '50' }))
  expect(bodyRows()).toHaveLength(30)
  expect(screen.getByText('1–30 / 30')).toBeInTheDocument()
  expect(url()).toBe('/chuyen?so-dong=50')
})

test('opening the list from a URL restores it, and coming back from a detail page keeps it', async () => {
  const user = userEvent.setup()
  render(renderTripList('/chuyen?q=bien+hoa&trang-thai=da-lap-ke-hoach&tu=2026-09-05&sap-xep=id'))

  expect(screen.getByRole('searchbox')).toHaveValue('bien hoa')
  expect(screen.getByRole('combobox', { name: 'Trạng thái' })).toHaveTextContent('Đã lập kế hoạch')
  expect(screen.getByLabelText('Từ ngày')).toHaveValue('2026-09-05')
  expect(header('Mã chuyến')).toHaveAttribute('aria-sort', 'ascending')
  expect(firstCells()).toStrictEqual(['TRIP-006', 'TRIP-009', 'TRIP-011', 'TRIP-014', 'TRIP-021', 'TRIP-024', 'TRIP-026', 'TRIP-029'])

  await user.click(screen.getByText('TRIP-011'))
  expect(url()).toBe('/chuyen/TRIP-011')
  await user.click(screen.getByRole('button', { name: 'Quay lại danh sách' }))

  expect(url()).toBe('/chuyen?q=bien+hoa&trang-thai=da-lap-ke-hoach&tu=2026-09-05&sap-xep=id')
  expect(screen.getByRole('searchbox')).toHaveValue('bien hoa')
  expect(firstCells()[0]).toBe('TRIP-006')
})

test('the whole list works from the keyboard', async () => {
  const user = userEvent.setup()
  render(renderTripList())
  /** Chỉ dùng Tab để tới nút: nút nào không tới được bằng Tab thì test hỏng. */
  const tabTo = async (element: HTMLElement) => {
    for (let step = 0; step < 20 && document.activeElement !== element; step++) await user.tab()
    expect(element).toHaveFocus()
  }

  await user.tab()
  expect(screen.getByRole('searchbox')).toHaveFocus()
  await user.keyboard('thu duc')
  await tabTo(screen.getByRole('button', { name: 'Xoá lọc' }))
  await user.keyboard('{Enter}')
  // Nút xoá lọc biến mất; tiêu điểm về ô tìm chứ không rơi ra ngoài trang.
  expect(screen.getByRole('searchbox')).toHaveFocus()
  expect(screen.getByRole('searchbox')).toHaveValue('')

  const status = screen.getByRole('combobox', { name: 'Trạng thái' })
  await tabTo(status)
  await user.keyboard('{Enter}')
  await user.keyboard('{ArrowDown}{Enter}')
  expect(status).toHaveTextContent('Nháp')
  expect(url()).toBe('/chuyen?trang-thai=nhap')

  await tabTo(screen.getByRole('button', { name: 'Mã chuyến' }))
  await user.keyboard('{Enter}')
  expect(header('Mã chuyến')).toHaveAttribute('aria-sort', 'ascending')
  await user.keyboard(' ')
  expect(header('Mã chuyến')).toHaveAttribute('aria-sort', 'descending')

  await user.click(screen.getByRole('button', { name: 'Xoá lọc' }))
  const next = screen.getByRole('button', { name: 'Trang sau' })
  await tabTo(next)
  await user.keyboard('{Enter}')
  expect(screen.getByText('26–30 / 30')).toBeInTheDocument()
  // Tới trang cuối nút chỉ báo vô hiệu, tiêu điểm vẫn ở đó để lùi lại bằng Shift+Tab.
  expect(next).toHaveFocus()
  await user.tab({ shift: true })
  expect(screen.getByRole('button', { name: 'Trang trước' })).toHaveFocus()
  await user.keyboard(' ')
  expect(screen.getByText('1–25 / 30')).toBeInTheDocument()
})

/** Màn tối giản quanh hook: một lần bấm đổi hai bộ lọc (như chọn cả kỳ), đổi cỡ trang, và địa chỉ hiện tại. */
function PeriodHarness({ defaultPageSize }: { defaultPageSize?: number }) {
  const list = useListUrlState({ filters: ['tu', 'den'], defaultPageSize })
  const location = useLocation()
  return (
    <>
      <button type="button" onClick={() => { list.setFilter('tu', '2026-09-01'); list.setFilter('den', '2026-09-30') }}>Cả tháng 9</button>
      <button type="button" onClick={() => list.setPageSize(25)}>25 dòng</button>
      <button type="button" onClick={() => list.setPageSize(50)}>50 dòng</button>
      <output aria-label="Cỡ trang">{list.pageSize}</output>
      <output data-testid="url">{location.pathname + location.search}</output>
    </>
  )
}

function renderPeriod(path: string, defaultPageSize?: number) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/nhat-ky" element={<PeriodHarness defaultPageSize={defaultPageSize} />} />
      </Routes>
    </MemoryRouter>,
  )
}

test('two filter changes before the list renders again both reach the URL (LM-100)', async () => {
  const user = userEvent.setup()
  renderPeriod('/nhat-ky?trang=3')
  // Hai lần ghi trong cùng một lần bấm: lần sau đọc bản nháp của lần trước, không đọc tham số cũ lúc render
  await user.click(screen.getByRole('button', { name: 'Cả tháng 9' }))
  expect(url()).toBe('/nhat-ky?tu=2026-09-01&den=2026-09-30')
})

test('a screen can default to 50 rows: the URL stays clean at 50 and says so-dong=25 when asked (LM-100)', async () => {
  const user = userEvent.setup()
  renderPeriod('/nhat-ky', 50)
  expect(screen.getByRole('status', { name: 'Cỡ trang' })).toHaveTextContent('50')

  await user.click(screen.getByRole('button', { name: '25 dòng' }))
  expect(url()).toBe('/nhat-ky?so-dong=25')
  expect(screen.getByRole('status', { name: 'Cỡ trang' })).toHaveTextContent('25')

  await user.click(screen.getByRole('button', { name: '50 dòng' }))
  expect(url()).toBe('/nhat-ky')
  expect(screen.getByRole('status', { name: 'Cỡ trang' })).toHaveTextContent('50')
})

test('without an option the default page size stays 25', () => {
  renderPeriod('/nhat-ky')
  expect(screen.getByRole('status', { name: 'Cỡ trang' })).toHaveTextContent('25')
})
