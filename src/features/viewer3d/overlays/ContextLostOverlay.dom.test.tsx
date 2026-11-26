import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { watchContextLoss } from '../scene/context-loss'
import { ContextLostOverlay } from './ContextLostOverlay'

test('mất ngữ cảnh WebGL: báo lại, xin trình duyệt khôi phục (preventDefault); ngữ cảnh về thì báo; gỡ rồi thì thôi nghe', () => {
  const canvas = document.createElement('canvas')
  const onLost = vi.fn()
  const onRestored = vi.fn()
  const stop = watchContextLoss(canvas, { onLost, onRestored })
  const lost = new Event('webglcontextlost', { cancelable: true })
  canvas.dispatchEvent(lost)
  expect(onLost).toHaveBeenCalledOnce()
  expect(lost.defaultPrevented).toBe(true)
  canvas.dispatchEvent(new Event('webglcontextrestored'))
  expect(onRestored).toHaveBeenCalledOnce()
  stop()
  canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
  expect(onLost).toHaveBeenCalledOnce()
})

test('lớp phủ nói khung 3D mất kết nối đồ hoạ và nút "Tải lại khung 3D" dựng lại khung', async () => {
  const onReload = vi.fn()
  render(<I18nProvider><ContextLostOverlay onReload={onReload} /></I18nProvider>)
  expect(screen.getByRole('alert')).toHaveTextContent('Khung 3D bị mất kết nối đồ hoạ')
  await userEvent.click(screen.getByRole('button', { name: 'Tải lại khung 3D' }))
  expect(onReload).toHaveBeenCalledOnce()
})
