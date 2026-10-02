import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { UserScope } from '@/lib/mock-db'
import type { UserFormValues } from './user-form.schema'
import { UserFormDialog } from './UserFormDialog'

/**
 * Hộp thoại thêm người dùng đứng riêng (LM-092), không qua kho: vai trò và ô kho theo phạm vi của người quản trị (FE-0-08). Luật bắt
 * buộc của schema ở `user-form.schema.test.ts`; kho từ chối vai trò ngoài phạm vi ở `lib/mock-db/users.test.ts`.
 */
function renderForm(scope: UserScope) {
  const onSubmit = vi.fn<(values: UserFormValues) => Promise<void>>().mockResolvedValue(undefined)
  render(<I18nProvider><UserFormDialog scope={scope} onClose={() => {}} onSubmit={onSubmit} /></I18nProvider>)
  return { onSubmit, form: within(screen.getByRole('dialog', { name: 'Thêm người dùng' })) }
}

/** Điền bằng một lần dán: nhanh hơn gõ từng phím khi cả bộ chạy song song. */
async function fill(user: UserEvent, field: HTMLElement, text: string) {
  await user.click(field)
  await user.paste(text)
}

async function fillIdentity(user: UserEvent, form: ReturnType<typeof renderForm>['form']) {
  await fill(user, form.getByLabelText('Họ và tên'), 'Vương Thị Bích Ngọc')
  await fill(user, form.getByLabelText('Số điện thoại'), '0926971238')
  await fill(user, form.getByLabelText('Email'), 'ngoc.vuong@loadmaster.vn')
}

async function roleOptions(user: UserEvent, form: ReturnType<typeof renderForm>['form']) {
  await user.click(form.getByRole('combobox', { name: 'Vai trò' }))
  return (await screen.findAllByRole('option')).map((option) => option.textContent)
}

test('quản trị hệ thống: chỉ ba vai trò nền tảng, không có ô kho, lưu được tài khoản nền tảng', async () => {
  const user = userEvent.setup()
  const { onSubmit, form } = renderForm('platform')
  expect(form.getByText(/^Tài khoản nền tảng, không thuộc công ty nào\./)).toBeInTheDocument()
  expect(form.queryByLabelText('Kho / chi nhánh')).toBeNull()
  // Vai trò chọn sẵn là vai trò nền tảng ít quyền nhất
  expect(form.getByRole('combobox', { name: 'Vai trò' })).toHaveTextContent('Hỗ trợ khách hàng')
  expect(await roleOptions(user, form)).toStrictEqual(['Quản trị hệ thống', 'Quản lý nền tảng', 'Hỗ trợ khách hàng'])
  await user.click(screen.getByRole('option', { name: 'Quản lý nền tảng' }))

  await fillIdentity(user, form)
  await user.click(form.getByRole('button', { name: 'Thêm người dùng' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.calls[0]?.[0]).toStrictEqual({
    fullName: 'Vương Thị Bích Ngọc', email: 'ngoc.vuong@loadmaster.vn', phone: '0926 971 238', role: 'systemManager', depot: '',
  })
})

test('quản trị công ty: chỉ năm vai trò công ty; bỏ trống kho thì báo lỗi ở ô kho và không lưu', async () => {
  const user = userEvent.setup()
  const { onSubmit, form } = renderForm('company')
  expect(form.getByRole('combobox', { name: 'Vai trò' })).toHaveTextContent('Điều phối viên')
  expect(await roleOptions(user, form)).toStrictEqual(['Quản trị công ty', 'Quản lý công ty', 'Điều phối viên', 'Nhân viên kho', 'Tài xế'])
  await user.click(screen.getByRole('option', { name: 'Tài xế' }))

  await fillIdentity(user, form)
  await user.click(form.getByRole('button', { name: 'Thêm người dùng' }))
  const depot = form.getByLabelText('Kho / chi nhánh')
  await waitFor(() => expect(depot).toHaveAccessibleDescription('Nhập kho hoặc chi nhánh'))
  expect(depot).toBeInvalid()
  expect(onSubmit).not.toHaveBeenCalled()

  await fill(user, depot, 'Kho Long Bình')
  await user.click(form.getByRole('button', { name: 'Thêm người dùng' }))
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.calls[0]?.[0]).toStrictEqual({
    fullName: 'Vương Thị Bích Ngọc', email: 'ngoc.vuong@loadmaster.vn', phone: '0926 971 238', role: 'driver', depot: 'Kho Long Bình',
  })
})
