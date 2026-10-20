import { render, screen } from '@testing-library/react'
import { toast } from 'sonner'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { Providers } from './providers'

/**
 * Vùng toast của sonner mặc định tên tiếng Anh ("Notifications alt+T", nút "Close toast") bất kể ngôn ngữ; `Providers` truyền chữ của
 * từ điển theo ngôn ngữ đang chọn.
 */
beforeEach(() => sessionStorage.clear())
afterEach(() => {
  toast.dismiss()
  window.history.replaceState(null, '', '/')
})

test('the toast region and its close buttons are named in the interface language', async () => {
  render(<Providers><p>Nội dung</p></Providers>)
  expect(screen.getByRole('region', { name: /^Thông báo tức thời/ })).toBeInTheDocument()

  toast('Đã lưu')
  expect(await screen.findByRole('button', { name: 'Đóng thông báo' })).toBeInTheDocument()
})

test('in English the toast region is named in English', () => {
  window.history.replaceState(null, '', '/?lang=en')
  render(<Providers><p>Content</p></Providers>)
  expect(screen.getByRole('region', { name: /^Live notifications/ })).toBeInTheDocument()
})
