import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { PlanTier } from '@/lib/mock-db'
import { TopUpDialog } from './TopUpDialog'

/** Nạp credit khi nối backend: giá và trần số dư theo hạng gói (như `CreditController`), nhập được số credit tuỳ ý. */
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['billing']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'billing',
}))

function renderDialog(tier: PlanTier, balance: number) {
  const onConfirm = vi.fn()
  render(
    <I18nProvider>
      <TopUpDialog open onOpenChange={() => {}} pending={false} onConfirm={onConfirm} tier={tier} balance={balance} />
    </I18nProvider>,
  )
  return onConfirm
}

test('Basic: 400 đ mỗi credit, nạp quá trần 3.000 thì không tiếp tục được', async () => {
  const user = userEvent.setup()
  const onConfirm = renderDialog('BASIC', 2600)
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveTextContent('400 ₫ mỗi credit')
  expect(dialog).toHaveTextContent('Hạng Basic: số dư tối đa 3.000 credit, còn nạp được 400.')
  const input = within(dialog).getByRole('spinbutton', { name: 'Số credit muốn nạp' })
  const confirm = within(dialog).getByRole('button', { name: 'Tiếp tục thanh toán' })
  await user.clear(input)
  await user.type(input, '500')
  expect(confirm).toBeDisabled()
  expect(dialog).toHaveTextContent('Số dư sau khi nạp (3.100 credit) vượt trần 3.000 credit của hạng Basic.')
  await user.clear(input)
  await user.type(input, '300')
  expect(dialog).toHaveTextContent('Thành tiền: 120.000 ₫')
  await user.click(confirm)
  expect(onConfirm).toHaveBeenCalledWith(300)
})

test('Ultimate: 263 đ mỗi credit, không trần', async () => {
  const user = userEvent.setup()
  const onConfirm = renderDialog('ULTIMATE', 30000)
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveTextContent('263 ₫ mỗi credit')
  expect(dialog).toHaveTextContent('Hạng Ultimate: không giới hạn số dư.')
  const input = within(dialog).getByRole('spinbutton', { name: 'Số credit muốn nạp' })
  await user.clear(input)
  await user.type(input, '5000')
  await user.click(within(dialog).getByRole('button', { name: 'Tiếp tục thanh toán' }))
  expect(onConfirm).toHaveBeenCalledWith(5000)
})
