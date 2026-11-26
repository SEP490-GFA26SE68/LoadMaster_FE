import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, stubBackend } from '@/test/fake-backend'

import { PackageTypeFormDialog } from './PackageTypeFormDialog'
import { fetchPackageType, savePackageType, type PackageType, type PackageTypeInput } from './package-types-api'

/**
 * Form loại kiện của máy chủ: ô "Sức chịu nén mặt trên" σ (kg/m²) để trống được và không bao giờ tự điền; trợ giúp McKee tính σ từ ECT,
 * độ dày tấm, hệ số an toàn và dài × rộng của loại kiện, "Dùng giá trị này" chỉ điền ô. Máy chủ bỏ qua `null` khi sửa nên xoá σ đã lưu bị
 * chặn kèm lý do.
 */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['packages']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'packages',
}))

const TYPE: PackageType = {
  id: '61', companyId: '1', typeCode: 'BOX-60', name: 'Thùng 60 × 40', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 8,
  maxStackWeightKg: 0, topLoadCapacityKgM2: 300, isFragile: false, rotationAllowed: true, allowRotateX: true, allowRotateY: true,
  allowRotateZ: true,
}

const TYPE_DTO = {
  id: 61, companyId: 1, typeCode: 'BOX-60', name: 'Thùng 60 × 40', length: 60, width: 40, height: 40, weightKg: 8, maxStackingWeightKg: 0,
  topLoadCapacityKgM2: '416.56', isFragile: false, rotationAllowed: true, allowRotateX: true, allowRotateY: true, allowRotateZ: true,
}

beforeEach(() => connectApiAuth(() => Promise.resolve('token-1')))
afterEach(() => {
  vi.unstubAllGlobals()
  connectApiAuth(() => Promise.resolve(null))
})

function renderDialog(type?: PackageType) {
  const onSubmit = vi.fn<(input: PackageTypeInput) => Promise<void>>(() => Promise.resolve())
  render(
    <I18nProvider>
      <PackageTypeFormDialog type={type} onClose={vi.fn()} onSubmit={onSubmit} />
    </I18nProvider>,
  )
  return onSubmit
}

async function replace(user: ReturnType<typeof userEvent.setup>, name: string, value: string) {
  const input = screen.getByRole('spinbutton', { name })
  await user.clear(input)
  await user.type(input, value)
}

test('thêm loại kiện để trống sức chịu nén: gửi null, không điền giá trị mặc định', async () => {
  const onSubmit = renderDialog()
  const user = userEvent.setup()

  expect(screen.getByRole('spinbutton', { name: 'Sức chịu nén mặt trên' })).toHaveValue(null)
  await user.type(screen.getByRole('textbox', { name: 'Tên loại kiện' }), 'Thùng nước suối')
  await user.click(screen.getByRole('button', { name: 'Thêm loại kiện' }))

  await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
  expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ name: 'Thùng nước suối', topLoadCapacityKgM2: null })
})

test('trợ giúp McKee: ví dụ của spec ra 416,56 kg/m², "Dùng giá trị này" điền ô σ rồi mới lưu', async () => {
  const onSubmit = renderDialog()
  const user = userEvent.setup()

  await user.type(screen.getByRole('textbox', { name: 'Tên loại kiện' }), 'Thùng carton 60 × 40')
  await replace(user, 'Dài', '60')
  await replace(user, 'Rộng', '40')
  await user.click(screen.getByText('Ước tính cho thùng carton'))
  expect(screen.getByText(/một lớp sóng, kiểu thùng nắp gập tiêu chuẩn \(RSC\), rỗng/)).toBeInTheDocument()

  await user.type(screen.getByRole('spinbutton', { name: 'Độ bền nén cạnh (ECT)' }), '5604')
  await user.type(screen.getByRole('spinbutton', { name: 'Độ dày tấm carton' }), '4')
  await user.type(screen.getByRole('spinbutton', { name: 'Hệ số an toàn' }), '3{Enter}')
  expect(onSubmit).not.toHaveBeenCalled()

  expect(await screen.findByText('416,56 kg/m²')).toBeInTheDocument()
  expect(screen.getByText('2.942 N')).toBeInTheDocument()
  expect(screen.getByText('0,24 m²')).toBeInTheDocument()
  expect(screen.getByRole('spinbutton', { name: 'Sức chịu nén mặt trên' })).toHaveValue(null)

  await user.click(screen.getByRole('button', { name: 'Dùng giá trị này' }))
  expect(screen.getByRole('spinbutton', { name: 'Sức chịu nén mặt trên' })).toHaveValue(416.56)

  await user.click(screen.getByRole('button', { name: 'Thêm loại kiện' }))
  await vi.waitFor(() => expect(onSubmit).toHaveBeenCalledOnce())
  expect(onSubmit.mock.calls[0]?.[0]).toMatchObject({ lengthCm: 60, widthCm: 40, topLoadCapacityKgM2: 416.56 })
})

test('sửa loại kiện đã có σ: để trống thì chặn kèm lý do, không gửi', async () => {
  const onSubmit = renderDialog(TYPE)
  const user = userEvent.setup()

  const sigma = screen.getByRole('spinbutton', { name: 'Sức chịu nén mặt trên' })
  expect(sigma).toHaveValue(300)
  await user.clear(sigma)
  await user.click(screen.getByRole('button', { name: 'Lưu loại kiện' }))

  expect(await screen.findByText(/Máy chủ chưa xoá được giá trị đã lưu/)).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()
})

test('σ âm hoặc quá hai chữ số lẻ là lỗi của ô', async () => {
  const onSubmit = renderDialog(TYPE)
  const user = userEvent.setup()

  await replace(user, 'Sức chịu nén mặt trên', '12.345')
  await user.click(screen.getByRole('button', { name: 'Lưu loại kiện' }))
  expect(await screen.findByText('Tối đa hai chữ số sau dấu thập phân.')).toBeInTheDocument()
  expect(onSubmit).not.toHaveBeenCalled()
})

test('API loại kiện: gửi σ khi lưu, đọc BigDecimal dạng chuỗi, máy chủ cũ không trả là null', async () => {
  const backend = stubBackend({
    'PUT /api/package-types/61': { body: envelope(TYPE_DTO) },
    'GET /api/package-types/62': { body: envelope({ ...TYPE_DTO, id: 62, topLoadCapacityKgM2: undefined }) },
  })

  const { id: _id, companyId: _company, ...input } = TYPE
  const saved = await savePackageType({ ...input, topLoadCapacityKgM2: 416.56 }, '61')

  expect(backend.calls[0]?.body).toMatchObject({ length: 60, width: 40, topLoadCapacityKgM2: 416.56 })
  expect(saved.topLoadCapacityKgM2).toBe(416.56)
  expect((await fetchPackageType('62')).topLoadCapacityKgM2).toBeNull()
})
