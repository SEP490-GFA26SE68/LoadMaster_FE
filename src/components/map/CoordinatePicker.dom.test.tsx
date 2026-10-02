import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { Place } from '@/lib/mock-db'
import { CoordinatePicker } from './CoordinatePicker'
import { EMPTY_COORDINATES, type CoordinateText } from './coordinates'

/**
 * Ô chọn toạ độ (FE-4b-03) trong jsdom: không có WebGL và không có khoá map tiles nên chỉ có danh sách địa danh mẫu và hai ô gõ — không
 * bản đồ, không tải chunk MapLibre. Toạ độ kỳ vọng chép từ `seed-places.ts`.
 */

function Harness({ initial = EMPTY_COORDINATES, onPlacePicked, disabled, showErrors }: {
  initial?: CoordinateText
  onPlacePicked?: (place: Place) => void
  disabled?: boolean
  showErrors?: boolean
}) {
  const [value, setValue] = useState(initial)
  return (
    <>
      <CoordinatePicker label="Toạ độ điểm đến" value={value} onChange={setValue} onPlacePicked={onPlacePicked} disabled={disabled} showErrors={showErrors} />
      <button type="button">Ô khác</button>
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  )
}

function renderPicker(props: Parameters<typeof Harness>[0] = {}) {
  render(
    <I18nProvider>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <Harness {...props} />
      </QueryClientProvider>
    </I18nProvider>,
  )
  return { user: userEvent.setup(), group: screen.getByRole('group', { name: 'Toạ độ điểm đến' }) }
}

const value = () => JSON.parse(screen.getByTestId('value').textContent ?? '') as CoordinateText

test('without WebGL and a map key there is no map: a place is picked from the sample list by keyboard', async () => {
  const onPlacePicked = vi.fn()
  const { user, group } = renderPicker({ onPlacePicked })
  expect(group.querySelector('[data-coordinate-map]')).toBeNull()
  expect(group.querySelector('canvas')).toBeNull()
  expect(within(group).getByText('Chọn từ danh sách địa danh mẫu (toạ độ gần đúng ở mức khu vực) hoặc gõ vĩ độ, kinh độ.')).toBeInTheDocument()

  const search = within(group).getByRole('combobox', { name: 'Tìm địa danh' })
  expect(search).toHaveAttribute('aria-expanded', 'false')
  await user.type(search, 'da nang')
  const options = await within(group).findAllByRole('option')
  expect(options.map((option) => option.textContent)).toStrictEqual([
    'Đà NẵngNam Trung Bộ · Tỉnh / thành16.0544, 108.2022',
    'Liên ChiểuĐà Nẵng · Quận / huyện16.0717, 108.15',
    'KCN Hoà KhánhQ. Liên Chiểu, Đà Nẵng · Khu công nghiệp16.0747, 108.1506',
  ])
  expect(search).toHaveAttribute('aria-expanded', 'true')
  expect(search).toHaveAttribute('aria-activedescendant', options[0]?.id)

  // ↓ ↓ tới khu công nghiệp, ↑ ↓ vẫn ở đó; Enter chọn
  await user.keyboard('{ArrowDown}{ArrowDown}')
  expect(search).toHaveAttribute('aria-activedescendant', options[2]?.id)
  await user.keyboard('{Enter}')
  expect(value()).toStrictEqual({ lat: '16.0747', lng: '108.1506' })
  expect(within(group).getByRole('textbox', { name: 'Vĩ độ' })).toHaveValue('16.0747')
  expect(within(group).getByRole('textbox', { name: 'Kinh độ' })).toHaveValue('108.1506')
  expect(within(group).getByRole('status')).toHaveTextContent('Đã lấy toạ độ của KCN Hoà Khánh.')
  expect(onPlacePicked).toHaveBeenCalledWith(expect.objectContaining({ name: 'KCN Hoà Khánh', region: 'Q. Liên Chiểu, Đà Nẵng' }))
  // Chọn xong: ô tìm trống lại, danh sách đóng, con trỏ vẫn ở ô tìm
  expect(search).toHaveValue('')
  expect(within(group).queryByRole('listbox')).toBeNull()
  expect(search).toHaveFocus()
})

test('a click picks too; a query without a match says so; Escape clears the query', async () => {
  const { user, group } = renderPicker()
  const search = within(group).getByRole('combobox', { name: 'Tìm địa danh' })
  await user.type(search, 'xyz')
  expect(await within(group).findByText('Không có địa danh mẫu nào khớp "xyz". Gõ toạ độ vào hai ô bên dưới.')).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(search).toHaveValue('')
  await user.type(search, 'tra noc')
  await user.click(await within(group).findByRole('option', { name: /KCN Trà Nóc/ }))
  expect(value()).toStrictEqual({ lat: '10.1028', lng: '105.7103' })
})

test('typed coordinates are checked at the field once the focus leaves the group; clearing empties both', async () => {
  const { user, group } = renderPicker()
  const lat = within(group).getByRole('textbox', { name: 'Vĩ độ' })
  const lng = within(group).getByRole('textbox', { name: 'Kinh độ' })
  await user.type(lat, '91')
  // Còn trong nhóm ô: chưa báo lỗi
  await user.type(lng, '106.8')
  expect(within(group).queryByText('Vĩ độ là số từ −90 đến 90')).toBeNull()
  await user.click(screen.getByRole('button', { name: 'Ô khác' }))
  expect(within(group).getByText('Vĩ độ là số từ −90 đến 90')).toBeInTheDocument()
  expect(lat).toHaveAttribute('aria-invalid', 'true')
  expect(lng).not.toHaveAttribute('aria-invalid')

  await user.clear(lat)
  await user.type(lat, '10,93')
  expect(within(group).queryByText('Vĩ độ là số từ −90 đến 90')).toBeNull()
  await user.clear(lng)
  expect(within(group).getByText('Nhập cả kinh độ')).toBeInTheDocument()
  expect(lng).toHaveAttribute('aria-invalid', 'true')
  await user.type(lng, '106.87')
  expect(within(group).queryByText('Nhập cả kinh độ')).toBeNull()
  expect(value()).toStrictEqual({ lat: '10,93', lng: '106.87' })

  await user.click(within(group).getByRole('button', { name: 'Bỏ toạ độ' }))
  expect(value()).toStrictEqual({ lat: '', lng: '' })
  expect(within(group).getByRole('button', { name: 'Bỏ toạ độ' })).toBeDisabled()
})

test('a submitted form shows the error at once; a locked picker only shows the coordinates', () => {
  const { group } = renderPicker({ initial: { lat: '10.9', lng: '181' }, showErrors: true })
  expect(within(group).getByText('Kinh độ là số từ −180 đến 180')).toBeInTheDocument()
})

test('disabled: no search box, no clear button, both fields read-only', () => {
  const { group } = renderPicker({ initial: { lat: '16.4022', lng: '107.696' }, disabled: true })
  expect(within(group).queryByRole('combobox')).toBeNull()
  expect(within(group).queryByRole('button', { name: 'Bỏ toạ độ' })).toBeNull()
  expect(within(group).getByRole('textbox', { name: 'Vĩ độ' })).toHaveAttribute('readonly')
  expect(within(group).getByRole('textbox', { name: 'Kinh độ' })).toHaveValue('107.696')
})
