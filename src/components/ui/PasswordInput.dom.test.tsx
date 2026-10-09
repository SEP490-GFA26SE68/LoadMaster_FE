import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { PasswordInput } from './PasswordInput'

test('the show / hide button flips the field between password and text without touching its value, name or the form', async () => {
  const user = userEvent.setup()
  let submitted = 0
  render(
    <I18nProvider>
      <form onSubmit={(event) => { event.preventDefault(); submitted += 1 }}>
        <PasswordInput label="Mật khẩu" defaultValue="loadmaster" />
      </form>
    </I18nProvider>,
  )
  const field = screen.getByLabelText('Mật khẩu')
  expect(field).toHaveAttribute('type', 'password')

  const show = screen.getByRole('button', { name: 'Hiện mật khẩu' })
  expect(show).toHaveAttribute('aria-pressed', 'false')
  await user.click(show)

  const hide = screen.getByRole('button', { name: 'Ẩn mật khẩu' })
  expect(hide).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type', 'text')
  expect(screen.getByLabelText('Mật khẩu')).toHaveValue('loadmaster')

  await user.click(hide)
  expect(screen.getByLabelText('Mật khẩu')).toHaveAttribute('type', 'password')
  expect(submitted).toBe(0)
})
