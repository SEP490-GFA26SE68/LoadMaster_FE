import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { EmptyState } from '@/components/EmptyState'
import { Lumo, LUMO_POSES } from './Lumo'

/** Lumo (LM-105): trang trí, không có tên truy cập; trạng thái rỗng vẫn đọc bằng chữ. */
test('Lumo is decorative: empty alt, hidden from assistive technology', () => {
  const { container } = render(<Lumo pose="done" />)
  const img = container.querySelector('img')
  expect(img).toHaveAttribute('alt', '')
  expect(img).toHaveAttribute('aria-hidden', 'true')
  expect(img).toHaveAttribute('src', LUMO_POSES.done)
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

test('an empty state with a mascot shows the pose instead of the icon tile and keeps its text', () => {
  const { container } = render(<EmptyState mascot="empty" title="Chưa có chuyến nào" description="Tạo chuyến đầu tiên." />)
  expect(container.querySelector('[data-lumo="empty"]')).toBeInTheDocument()
  expect(screen.getByText('Chưa có chuyến nào')).toBeInTheDocument()
  expect(screen.getByText('Tạo chuyến đầu tiên.')).toBeInTheDocument()
})

test('every pose has its own picture', () => {
  const urls = Object.values(LUMO_POSES)
  expect(new Set(urls).size).toBe(urls.length)
  expect(Object.keys(LUMO_POSES)).toStrictEqual(['greet', 'empty', 'notFound', 'error', 'done', 'warehouseWaiting', 'driverWaiting'])
})
