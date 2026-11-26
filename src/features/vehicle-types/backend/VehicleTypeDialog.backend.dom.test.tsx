import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'

import { I18nProvider } from '@/lib/i18n'

import { VehicleTypeDialog } from './VehicleTypeDialog'
import type { VehicleType, VehicleTypeInput } from './vehicle-types-api'

/**
 * Form loại xe của máy chủ: lệch trọng tâm ngang (%, đổi sang tỷ lệ) và tải trọng sàn (kg/m²) tuỳ chọn — trống là chưa khai, không tự
 * điền. Máy chủ bỏ qua `null` khi sửa nên xoá giá trị đã lưu bị chặn kèm lý do.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['fleet']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'fleet',
}))

const TYPE: VehicleType = {
  id: '7', name: 'Xe tải 5 tấn', cargoLengthCm: 620, cargoWidthCm: 235, cargoHeightCm: 240, doorWidthCm: 230, doorHeightCm: 230,
  payloadKg: 5000, frontAxleX: null, rearAxleX: null, emptyFrontAxleLoadKg: null, emptyRearAxleLoadKg: null, maxCogOffsetRatio: 0.15,
  maxCogOffsetRatioY: null, floorLoadCapacityKgM2: null, hazardousCapable: false, obstacles: [], vehicleCount: 0,
}

function renderDialog(type: VehicleType) {
  const onSubmit = vi.fn<(input: VehicleTypeInput) => void>()
  render(
    <I18nProvider>
      <VehicleTypeDialog open type={type} pending={false} onOpenChange={vi.fn()} onSubmit={onSubmit} />
    </I18nProvider>,
  )
  return onSubmit
}

const cogY = () => screen.getByRole('spinbutton', { name: 'Lệch trọng tâm ngang tối đa' })
const floorLoad = () => screen.getByRole('spinbutton', { name: 'Tải trọng sàn' })

test('hai ô mới để trống thì không gửi gì; nhập thì gửi tỷ lệ lệch ngang và kg/m²', async () => {
  const onSubmit = renderDialog(TYPE)
  const user = userEvent.setup()

  expect(cogY()).toHaveValue(null)
  expect(floorLoad()).toHaveValue(null)
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
  expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('maxCogOffsetRatioY')
  expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('floorLoadCapacityKgM2')

  await user.type(cogY(), '12.5')
  await user.type(floorLoad(), '1500')
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
  await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2))
  expect(onSubmit.mock.calls[1]?.[0]).toMatchObject({ maxCogOffsetRatio: 0.15, maxCogOffsetRatioY: 0.125, floorLoadCapacityKgM2: 1500 })
})

test('giá trị đã lưu hiện lại theo %, và xoá đi thì bị chặn kèm lý do', async () => {
  const onSubmit = renderDialog({ ...TYPE, maxCogOffsetRatioY: 0.2, floorLoadCapacityKgM2: 1200 })
  const user = userEvent.setup()

  expect(cogY()).toHaveValue(20)
  expect(floorLoad()).toHaveValue(1200)
  await user.clear(floorLoad())
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

  expect(await screen.findByText(/Máy chủ chưa xoá được giá trị đã lưu/)).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()
})

test('lệch ngang ngoài khoảng 0–50 % và tải trọng sàn không dương là lỗi của ô', async () => {
  const onSubmit = renderDialog(TYPE)
  const user = userEvent.setup()

  await user.type(cogY(), '60')
  await user.type(floorLoad(), '0')
  await user.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

  expect(await screen.findByText('Nhập số lớn hơn 0 và không quá 50.')).toBeInTheDocument()
  expect(screen.getByText('Nhập số lớn hơn 0.')).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()
})
