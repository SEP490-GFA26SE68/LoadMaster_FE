import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { OptimizationErrorDialog } from './OptimizationErrorDialog'

test('a rejected request lists each input error with its severity and offers only Close (V2.3)', async () => {
  const onClose = vi.fn()
  render(
    <I18nProvider>
      <OptimizationErrorDialog
        failure={{ kind: 'failed', issues: [{ severity: 'error', message: 'Kiện PKG-007 không lọt qua cửa.' }, { severity: 'warning', message: 'Vượt tải trọng.' }] }}
        onRetry={vi.fn()}
        onClose={onClose}
      />
    </I18nProvider>,
  )
  const dialog = screen.getByRole('dialog', { name: 'Dữ liệu đầu vào không hợp lệ' })
  const items = within(dialog).getAllByRole('listitem')
  expect(items.map((item) => item.textContent)).toStrictEqual(['LỗiKiện PKG-007 không lọt qua cửa.', 'Cảnh báoVượt tải trọng.'])
  expect(within(dialog).queryByRole('button', { name: 'Thử lại' })).toBeNull()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Đóng' }))
  expect(onClose).toHaveBeenCalled()
})

test('a service failure can be retried, and the corner button closes it', async () => {
  const onRetry = vi.fn()
  const onClose = vi.fn()
  render(
    <I18nProvider>
      <OptimizationErrorDialog failure={{ kind: 'service', code: 'WORKER_CRASHED' }} onRetry={onRetry} onClose={onClose} />
    </I18nProvider>,
  )
  const dialog = screen.getByRole('dialog', { name: 'Không chạy được tối ưu' })
  expect(dialog).toHaveTextContent('Tiến trình tối ưu bị dừng đột ngột. Thử lại.')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Thử lại' }))
  expect(onRetry).toHaveBeenCalled()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Đóng hộp thoại' }))
  expect(onClose).toHaveBeenCalled()
})
