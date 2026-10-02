import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { SPEC_TRUCK_6M } from '@/domain/fixtures/spec-samples'
import type { CargoPackage } from '@/domain/models'
import { I18nProvider } from '@/lib/i18n'
import { PackageFormPanel } from './PackageFormPanel'
import type { StopRow } from './trip-summary'

const STOPS: StopRow[] = [
  { id: 'STOP-1', number: 1, name: 'Kho Long Bình', address: 'Biên Hoà', packageCount: 0, weightKg: 0 },
]

const PACKAGE: CargoPackage = {
  id: 'PKG-001', name: 'Thùng carton A', lengthCm: 60, widthCm: 40, heightCm: 30, weightKg: 12, quantity: 2,
  allowedOrientations: ['LWH', 'HLW'], keepUpright: false, fragilityLevel: 'NONE', stackable: true,
  maxTopLoadKg: 80, minSupportRatio: 0.8, deliveryStop: 1, priority: 0, mustLoad: false,
}

function renderPanel(value: CargoPackage = PACKAGE) {
  const onSave = vi.fn()
  render(
    <I18nProvider>
      <PackageFormPanel value={value} vehicle={SPEC_TRUCK_6M} stops={STOPS} onSave={onSave} onClose={() => undefined} />
    </I18nProvider>,
  )
  return { onSave, user: userEvent.setup() }
}

test('turning on keep upright drops the lying orientations, says how many, and locks them (D-25)', async () => {
  const { user } = renderPanel()
  const lying = screen.getByRole('checkbox', { name: 'HLW' })
  expect(lying).toBeChecked()

  await user.click(screen.getByRole('switch', { name: 'Giữ thẳng đứng' }))

  await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Đã bỏ 1 hướng nằm nghiêng'))
  expect(screen.getByRole('checkbox', { name: 'HLW' })).not.toBeChecked()
  expect(screen.getByRole('checkbox', { name: 'HLW' })).toBeDisabled()
  expect(screen.getByRole('checkbox', { name: 'LWH' })).toBeEnabled()
})

test('turning off stackable zeroes the max top load and disables the field (D-25)', async () => {
  const { user } = renderPanel()
  const maxTopLoad = screen.getByLabelText(/Tải tối đa chịu được phía trên/)
  expect(maxTopLoad).toHaveValue(80)

  await user.click(screen.getByRole('switch', { name: 'Cho phép xếp chồng lên trên' }))

  await waitFor(() => expect(screen.getByLabelText(/Tải tối đa chịu được phía trên/)).toHaveValue(0))
  expect(screen.getByLabelText(/Tải tối đa chịu được phía trên/)).toBeDisabled()
})

test('a package that cannot fit through the door shows the Spec door error while editing', async () => {
  // Cửa của Truck 6m: 220 × 230 cm. Kiện 300 × 300 cm không lọt ở hướng nào.
  renderPanel({ ...PACKAGE, lengthCm: 300, widthCm: 300, heightCm: 300, allowedOrientations: ['LWH'] })
  expect(await screen.findByRole('alert')).toHaveTextContent(/cửa/i)
})

test('saving a valid package hands the edited values back', async () => {
  const { onSave, user } = renderPanel()
  await user.clear(screen.getByLabelText(/Tên kiện/))
  await user.type(screen.getByLabelText(/Tên kiện/), 'Thùng carton B')
  await user.click(screen.getByRole('button', { name: 'Lưu kiện' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  expect(onSave.mock.calls[0]?.[0]).toMatchObject({ id: 'PKG-001', name: 'Thùng carton B' })
})

test('the handling class shows Standard for a package that never declared one, and is only written when chosen (FE-3b-07)', async () => {
  const { onSave, user } = renderPanel()
  expect(screen.getByRole('combobox', { name: 'Loại hàng' })).toHaveTextContent('Thường')
  await user.click(screen.getByRole('button', { name: 'Lưu kiện' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
  // Lưu mà không đụng tới loại hàng: kiện giữ nguyên, phương án không lỗi thời vì một trường tự thêm
  expect(onSave.mock.calls[0]?.[0]).toStrictEqual(PACKAGE)

  await user.click(screen.getByRole('combobox', { name: 'Loại hàng' }))
  await user.click(await screen.findByRole('option', { name: 'Dễ vỡ' }))
  await user.click(screen.getByRole('button', { name: 'Lưu kiện' }))
  await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2))
  expect(onSave.mock.calls[1]?.[0]).toStrictEqual({ ...PACKAGE, handlingClass: 'FRAGILE' })
})

test('an invalid package is not saved and field errors read as sentences, not schema codes (LM-054)', async () => {
  const { onSave, user } = renderPanel()
  await user.click(screen.getByRole('checkbox', { name: 'LWH' }))
  await user.click(screen.getByRole('checkbox', { name: 'HLW' }))
  await user.clear(screen.getByLabelText(/Số lượng/))
  await user.type(screen.getByLabelText(/Số lượng/), '0')
  await user.click(screen.getByRole('button', { name: 'Lưu kiện' }))

  expect(await screen.findByText('Chọn ít nhất một hướng đặt.')).toBeInTheDocument()
  expect(screen.getByText('Số lượng tối thiểu là 1.')).toBeInTheDocument()
  expect(screen.queryByText(/^package\./)).not.toBeInTheDocument()
  expect(onSave).not.toHaveBeenCalled()
})
