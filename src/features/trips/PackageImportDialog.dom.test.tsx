import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { expect, test } from 'vitest'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { TripDetailPage } from './TripDetailPage'

const SLOW = { timeout: 4000 }
const TRIP = 'TRIP-014'

/** Seam: bảng kiện ở Chi tiết chuyến → hộp thoại nhập → kho dùng chung (LM-093), đăng nhập điều phối viên, không giả lập module nào. */
function renderDetail() {
  signedInAs('dispatcher')
  const router = createMemoryRouter([{ path: '/chuyen/:tripId', element: <TripDetailPage /> }], { initialEntries: [`/chuyen/${TRIP}`] })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <I18nProvider>
      <AuthProvider>
        <QueryClientProvider client={client}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </AuthProvider>
    </I18nProvider>,
  )
  return userEvent.setup()
}

async function openImport(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Nhập từ file' }, SLOW))
  return screen.findByRole('dialog', { name: 'Nhập kiện từ file' })
}

const csvFile = (text: string, name = 'kien.csv') => new File([text], name, { type: 'text/csv' })

test('a file with one bad row: the preview names the row and why, then only the valid rows are imported in one write', async () => {
  const db = getMockDb()
  const before = await db.getTrip(TRIP)
  const eventsBefore = (await db.listEvents({ targetId: TRIP })).length
  const user = renderDetail()
  const dialog = within(await openImport(user))
  expect(dialog.getByRole('button', { name: 'Nhập kiện' })).toBeDisabled()

  await user.upload(dialog.getByLabelText('File kiện (.csv, .xlsx)'), csvFile(
    '﻿Mã kiện;Tên kiện;Dài (cm);Rộng (cm);Cao (cm);Khối lượng (kg);Số lượng;Điểm giao\n'
    + 'PKG-010;Thùng quạt bàn;45;45;60;9,5;4;1\n'
    + 'PKG-011;Thùng nồi cơm;40;40;abc;5;2;2\n'
    + 'PKG-012;Kiện nước suối;50;35;25;13;6;2\n',
  ))

  expect(await dialog.findByText('Đọc được 3 dòng: 2 hợp lệ, 1 lỗi.')).toBeInTheDocument()
  expect(dialog.getByText('Cao (cm): "abc" không phải là số.')).toBeInTheDocument()
  // V2.3: dòng lỗi là một hàng của bảng lỗi — số dòng, mã · tên kiện, rồi lỗi
  const errors = within(dialog.getByRole('region', { name: '1 dòng lỗi, sẽ bỏ qua' }))
  expect(errors.getByRole('row', { name: /^3 PKG-011 · Thùng nồi cơm/ })).toBeInTheDocument()
  expect(dialog.getByText('Bỏ qua 1 dòng lỗi.')).toBeInTheDocument()
  await user.click(dialog.getByRole('button', { name: 'Nhập 2 dòng hợp lệ' }))

  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument(), SLOW)
  const after = await db.getTrip(TRIP)
  expect(after.packages.map((pkg) => pkg.id)).toStrictEqual([...before.packages.map((pkg) => pkg.id), 'PKG-010', 'PKG-012'])
  expect(after.packages.find((pkg) => pkg.id === 'PKG-010')).toMatchObject({ weightKg: 9.5, quantity: 4, deliveryStop: 1 })
  expect(after.inputVersion).toBe(before.inputVersion + 1)
  const events = await db.listEvents({ targetId: TRIP })
  expect(events).toHaveLength(eventsBefore + 1)
  expect(events[0]).toMatchObject({ action: 'trip.updated', params: { fields: 'packages' } })
  expect(await screen.findByRole('row', { name: /PKG-012/ })).toBeInTheDocument()
})

test('a file without the required columns says which are missing and cannot be imported', async () => {
  const user = renderDetail()
  const dialog = within(await openImport(user))
  await user.upload(dialog.getByLabelText('File kiện (.csv, .xlsx)'), csvFile('id,name,quantity\nPKG-020,Kiện,1\n'))
  expect(await dialog.findByRole('alert')).toHaveTextContent('Thiếu cột bắt buộc: Dài (cm), Rộng (cm), Cao (cm), Khối lượng (kg) và Điểm giao.')
  expect(dialog.getByRole('button', { name: 'Nhập kiện' })).toBeDisabled()
})

test('a file that is neither .csv nor .xlsx cannot be read', async () => {
  const user = userEvent.setup({ applyAccept: false })
  renderDetail()
  const dialog = within(await openImport(user))
  await user.upload(dialog.getByLabelText('File kiện (.csv, .xlsx)'), new File(['x'], 'kien.pdf', { type: 'application/pdf' }))
  expect(await dialog.findByRole('alert')).toHaveTextContent('Không đọc được file này. Chọn file .csv (UTF-8) hoặc .xlsx.')
})
