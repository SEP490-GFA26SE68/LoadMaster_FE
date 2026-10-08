import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { LOAD, renderDriver } from './driver-test-utils'

/**
 * Nút "Thêm" ở màn điểm giao của tài xế (V2.3 đợt 6): gom "Sự cố trên đường" và "Nhận hàng dọc đường" vào một tờ trượt; mỗi hàng mở đúng
 * hộp thoại cũ. `TRIP-009` đang vận chuyển, gán cho tài xế `US-0006` (có `exceptions.report` và `pickups.create`).
 */
test('"Thêm" opens a sheet that lists the two on-the-road actions, and a row opens its own dialog', async () => {
  renderDriver('/tai-xe/diem-giao?chuyen=TRIP-009', 'US-0006')
  // Hai việc đó không còn là nút nằm giữa màn
  expect(await screen.findByRole('heading', { level: 1, name: /^Điểm \d \/ 3$/ }, LOAD)).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Sự cố trên đường' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Nhận hàng dọc đường' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Thêm' }))
  const sheet = within(screen.getByRole('dialog', { name: 'Thêm thao tác' }))
  expect(sheet.getAllByRole('button').map((button) => button.textContent)).toStrictEqual(['Sự cố trên đường', 'Nhận hàng dọc đường'])

  await userEvent.click(sheet.getByRole('button', { name: 'Sự cố trên đường' }))
  expect(await screen.findByRole('dialog', { name: 'Báo sự cố chuyến TRIP-009' })).toBeInTheDocument()
  expect(screen.queryByRole('dialog', { name: 'Thêm thao tác' })).not.toBeInTheDocument()
}, 20_000)
