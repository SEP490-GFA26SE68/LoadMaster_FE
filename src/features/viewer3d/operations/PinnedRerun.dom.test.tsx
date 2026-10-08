import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { PinnedRerun } from './PinnedRerun'

/** Nhãn kiện đã ghim và nút "Chạy lại giữ ghim" ở góc khung 3D của Planner (FE-BL-02). */
function renderEntry(props: { count: number; unsaved: boolean }) {
  const onRerun = vi.fn()
  const view = render(<I18nProvider><PinnedRerun {...props} onRerun={onRerun} /></I18nProvider>)
  return { onRerun, view, user: userEvent.setup() }
}

test('with saved pins the entry says how many and runs again; with unsaved pins it is dimmed and says why; with none it is absent', async () => {
  const saved = renderEntry({ count: 3, unsaved: false })
  expect(screen.getByText('3 kiện đã ghim')).toBeInTheDocument()
  await saved.user.click(screen.getByRole('button', { name: 'Chạy lại giữ ghim' }))
  expect(saved.onRerun).toHaveBeenCalledOnce()
  saved.view.unmount()

  const unsaved = renderEntry({ count: 2, unsaved: true })
  const dimmed = screen.getByRole('button', { name: 'Chạy lại giữ ghim' })
  expect(dimmed).toBeDisabled()
  expect(dimmed).toHaveAccessibleDescription('Duyệt bản chỉnh để lưu ghim trước khi chạy lại.')
  expect(screen.getByText('Duyệt bản chỉnh để lưu ghim trước khi chạy lại.')).toBeVisible()
  unsaved.view.unmount()

  expect(renderEntry({ count: 0, unsaved: false }).view.container).toBeEmptyDOMElement()
})
