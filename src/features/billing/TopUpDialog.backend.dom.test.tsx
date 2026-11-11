import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { PlanTier } from '@/lib/mock-db'
import { TopUpDialog } from './TopUpDialog'

/** Nạp credit khi nối backend: giá theo hạng gói (như `CreditServiceImpl.topup`), không trần số dư, nhập được số credit tuỳ ý. */
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

test('Basic: 400 đ mỗi credit, không trần số dư (backend không đặt trần)', async () => {
  const user = userEvent.setup()
  const onConfirm = renderDialog('BASIC', 2600)
  const dialog = await screen.findByRole('dialog')
  expect(dialog).toHaveTextContent('400 ₫ mỗi credit')
  expect(dialog).toHaveTextContent('Hạng Basic: không giới hạn số dư.')
  const input = within(dialog).getByRole('spinbutton', { name: 'Số credit muốn nạp' })
  const confirm = within(dialog).getByRole('button', { name: 'Tiếp tục thanh toán' })
  await user.clear(input)
  await user.type(input, '5000')
  expect(confirm).toBeEnabled()
  expect(dialog).toHaveTextContent('Thành tiền: 2.000.000 ₫')
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
