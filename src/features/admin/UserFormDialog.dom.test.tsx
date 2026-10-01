import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent, { type UserEvent } from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { UserFormValues } from './user-form.schema'
import { UserFormDialog } from './UserFormDialog'

/**
 * Hộp thoại thêm người dùng đứng riêng (LM-092), không qua kho: ô kho theo vai trò (FE-0-03). Luật bắt buộc của schema ở
 * `user-form.schema.test.ts`; kho bỏ kho và công ty của tài khoản nền tảng ở `lib/mock-db/users.test.ts`.
 */
function renderForm() {
  const onSubmit = vi.fn<(values: UserFormValues) => Promise<void>>().mockResolvedValue(undefined)
  render(<I18nProvider><UserFormDialog onClose={() => {}} onSubmit={onSubmit} /></I18nProvider>)
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

async function pickRole(user: UserEvent, form: ReturnType<typeof renderForm>['form'], role: string) {
  await user.click(form.getByRole('combobox', { name: 'Vai trò' }))
  await user.click(await screen.findByRole('option', { name: role }))
}

test('ô vai trò liệt kê tám vai trò theo thứ tự cột của ma trận quyền', async () => {
  const user = userEvent.setup()
  const { form } = renderForm()
  await user.click(form.getByRole('combobox', { name: 'Vai trò' }))
  expect((await screen.findAllByRole('option')).map((option) => option.textContent)).toStrictEqual([
    'Quản trị hệ thống', 'Quản lý nền tảng', 'Hỗ trợ khách hàng', 'Quản trị công ty', 'Quản lý công ty', 'Điều phối viên',
    'Nhân viên kho', 'Tài xế',
  ])
})

test('vai trò nền tảng: ô kho bị khoá kèm lý do, form lưu được mà không cần kho', async () => {
  const user = userEvent.setup()
  const { onSubmit, form } = renderForm()
  await fillIdentity(user, form)
  // Vai trò mặc định (điều phối viên) là của công ty: ô kho mở
  const depot = form.getByLabelText('Kho / chi nhánh')
  expect(depot).toBeEnabled()

  await pickRole(user, form, 'Hỗ trợ khách hàng')
  expect(depot).toBeDisabled()
  expect(depot).toHaveAccessibleDescription('Vai trò nền tảng không thuộc kho nào')
  await user.click(form.getByRole('button', { name: 'Thêm người dùng' }))

  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
  expect(onSubmit.mock.calls[0]?.[0]).toStrictEqual({
    fullName: 'Vương Thị Bích Ngọc', email: 'ngoc.vuong@loadmaster.vn', phone: '0926 971 238', role: 'systemSupporter', depot: '',
  })
})

test('vai trò của công ty: bỏ trống kho thì báo lỗi ở ô kho và không lưu; đổi sang vai trò nền tảng thì lỗi đó mất', async () => {
  const user = userEvent.setup()
  const { onSubmit, form } = renderForm()
  await fillIdentity(user, form)
  await user.click(form.getByRole('button', { name: 'Thêm người dùng' }))

  const depot = form.getByLabelText('Kho / chi nhánh')
  await waitFor(() => expect(depot).toHaveAccessibleDescription('Nhập kho hoặc chi nhánh'))
  expect(depot).toBeInvalid()
  expect(onSubmit).not.toHaveBeenCalled()

  await pickRole(user, form, 'Quản lý nền tảng')
  expect(depot).toHaveAccessibleDescription('Vai trò nền tảng không thuộc kho nào')
  expect(depot).not.toBeInvalid()
})
