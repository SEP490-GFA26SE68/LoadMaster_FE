import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { TopUpDialog } from './TopUpDialog'

test('BASIC tier charges 400 VND/credit, supports custom credit input, and blocks when currentBalance + credits > 3000', async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn()

  render(
    <I18nProvider>
      <TopUpDialog
        open
        onOpenChange={() => {}}
        pending={false}
        onConfirm={onConfirm}
        tier="BASIC"
        currentBalance={2600}
      />
    </I18nProvider>,
  )

  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveTextContent('400')
  expect(dialog).toHaveTextContent('3.000')

  const customInput = within(dialog).getByLabelText('Số credit muốn mua thêm')
  await user.clear(customInput)
  await user.type(customInput, '500')

  // 2600 + 500 = 3100 > 3000 -> nút Tiếp tục thanh toán bị khoá
  const confirmBtn = within(dialog).getByRole('button', { name: 'Tiếp tục thanh toán' })
  expect(confirmBtn).toBeDisabled()

  await user.clear(customInput)
  await user.type(customInput, '300')
  // 2600 + 300 = 2900 <= 3000 -> hợp lệ, giá 300 * 400 = 120.000 ₫
  expect(confirmBtn).not.toBeDisabled()
  await user.click(confirmBtn)
  expect(onConfirm).toHaveBeenCalledWith(300)
})

test('PRO tier charges 326 VND/credit and enforces 10000 cumulative cap; ULTIMATE tier charges 263 VND/credit with no cap', async () => {
  const user = userEvent.setup()
  const onConfirm = vi.fn()

  const { rerender } = render(
    <I18nProvider>
      <TopUpDialog
        open
        onOpenChange={() => {}}
        pending={false}
        onConfirm={onConfirm}
        tier="PRO"
        currentBalance={9800}
      />
    </I18nProvider>,
  )

  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveTextContent('326')
  const customInput = within(dialog).getByLabelText('Số credit muốn mua thêm')
  await user.clear(customInput)
  await user.type(customInput, '300')

  const confirmBtn = within(dialog).getByRole('button', { name: 'Tiếp tục thanh toán' })
  expect(confirmBtn).toBeDisabled()

  rerender(
    <I18nProvider>
      <TopUpDialog
        open
        onOpenChange={() => {}}
        pending={false}
        onConfirm={onConfirm}
        tier="ULTIMATE"
        currentBalance={30000}
      />
    </I18nProvider>,
  )

  expect(dialog).toHaveTextContent('263')
  await user.clear(customInput)
  await user.type(customInput, '5000')
  expect(confirmBtn).not.toBeDisabled()
  await user.click(confirmBtn)
  expect(onConfirm).toHaveBeenCalledWith(5000)
})
