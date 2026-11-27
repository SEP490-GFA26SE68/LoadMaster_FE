import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { VehicleTypeInput } from '@/lib/mock-db'
import { I18nProvider } from '@/lib/i18n'
import { VehicleTypeDialog } from './VehicleTypeDialog'
import type { VehicleTypeEntry } from './vehicle-types-api'

/**
 * Form loại xe của kho mẫu: ô "Kiểu thân xe" mở sẵn ở "Tự chọn theo kích thước" (không gửi kiểu nào), chọn được một trong bốn kiểu van,
 * và kiểu đã lưu hiện lại khi sửa.
 */

const TYPE: VehicleTypeEntry = {
  id: 'VT-009', name: 'Van cỡ trung 1,5 tấn', cargoLengthCm: 320, cargoWidthCm: 170, cargoHeightCm: 170, payloadKg: 1500, maxCogOffsetRatio: 0.15,
}

function renderDialog(type: VehicleTypeEntry) {
  const onSubmit = vi.fn<(input: VehicleTypeInput) => void>()
  render(
    <I18nProvider>
      <VehicleTypeDialog open type={type} pending={false} onOpenChange={vi.fn()} onSubmit={onSubmit} />
    </I18nProvider>,
  )
  return onSubmit
}

const bodyStyle = () => screen.getByRole('combobox', { name: 'Kiểu thân xe' })
const save = () => screen.getByRole('button', { name: 'Lưu thay đổi' })

test('the body style starts automatic, lists the four vans and the four trucks, and the chosen one is saved', async () => {
  const onSubmit = renderDialog(TYPE)
  const user = userEvent.setup()

  expect(bodyStyle()).toHaveTextContent('Tự chọn theo kích thước')
  expect(screen.getByText(/Chỉ đổi hình xe ở khung 3D/)).toBeInTheDocument()
  await user.click(save())
  await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
  expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('bodyStyle')

  await user.click(bodyStyle())
  expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toStrictEqual([
    'Tự chọn theo kích thước', 'Van mini mũi bằng', 'Van mini mũi ngắn', 'Van cỡ trung', 'Van cỡ lớn',
    'Xe tải thùng kín', 'Xe tải mui bạt', 'Xe tải thùng lửng', 'Xe tải thùng đông lạnh',
  ])
  await user.click(screen.getByRole('option', { name: 'Van mini mũi ngắn' }))
  await user.click(save())
  await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
  expect(onSubmit.mock.calls[1]?.[0]).toMatchObject({ name: TYPE.name, bodyStyle: 'VAN_MINI_HOOD' })
})

test('a stored body style shows again, and going back to automatic clears it', async () => {
  const onSubmit = renderDialog({ ...TYPE, bodyStyle: 'VAN_LARGE' })
  const user = userEvent.setup()

  expect(bodyStyle()).toHaveTextContent('Van cỡ lớn')
  await user.click(bodyStyle())
  await user.click(await screen.findByRole('option', { name: 'Tự chọn theo kích thước' }))
  await user.click(save())
  await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
  expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('bodyStyle')
})
