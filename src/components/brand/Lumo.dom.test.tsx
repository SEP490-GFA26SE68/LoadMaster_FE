import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { EmptyState } from '@/components/EmptyState'
import { Lumo, LUMO_ASSET_PX, LUMO_NAME, LUMO_POSES, type LumoPose } from './Lumo'

/** Mười bốn tư thế theo đúng thứ tự khai báo (AGENTS "Thương hiệu"): bảy tư thế của ứng dụng, bốn toàn thân, ba bán thân. */
const POSES: readonly LumoPose[] = [
  'greet', 'empty', 'notFound', 'error', 'done', 'warehouseWaiting', 'driverWaiting',
  'point', 'carry', 'scan', 'tablet',
  'explain', 'idea', 'wink',
]

function imageOf(container: HTMLElement): HTMLImageElement {
  const img = container.querySelector('img')
  if (!img) throw new Error('Lumo không vẽ thẻ ảnh')
  return img
}

/** Lumo (LM-105): trang trí, không có tên truy cập; trạng thái rỗng vẫn đọc bằng chữ. */
test('Lumo is decorative: empty alt, hidden from assistive technology', () => {
  const { container } = render(<Lumo pose="done" />)
  const img = imageOf(container)
  expect(img).toHaveAttribute('alt', '')
  expect(img).toHaveAttribute('aria-hidden', 'true')
  expect(img).toHaveAttribute('src', LUMO_POSES.done)
  expect(img).toHaveAttribute('decoding', 'async')
  expect(img).toHaveAttribute('draggable', 'false')
  expect(img).toHaveAttribute('loading', 'eager')
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
})

test('an empty state with a mascot shows the pose instead of the icon tile and keeps its text', () => {
  const { container } = render(<EmptyState mascot="empty" title="Chưa có chuyến nào" description="Tạo chuyến đầu tiên." />)
  expect(container.querySelector('[data-lumo="empty"]')).toBeInTheDocument()
  expect(screen.getByText('Chưa có chuyến nào')).toBeInTheDocument()
  expect(screen.getByText('Tạo chuyến đầu tiên.')).toBeInTheDocument()
})

test('there are fourteen poses, each with its own picture', () => {
  const urls = Object.values(LUMO_POSES)
  expect(new Set(urls).size).toBe(urls.length)
  expect(Object.keys(LUMO_POSES)).toStrictEqual(POSES)
  expect(Object.keys(LUMO_ASSET_PX)).toStrictEqual(POSES)
})

/** Cạnh thật đọc từ đầu file WebP lúc thêm ảnh: bảy tư thế cũ 320 px, toàn thân 512 px, bán thân 400 px. */
test('the asset sizes are the real edges of the pictures', () => {
  expect(LUMO_ASSET_PX).toStrictEqual({
    greet: 320, empty: 320, notFound: 320, error: 320, done: 320, warehouseWaiting: 320, driverWaiting: 320,
    point: 512, carry: 512, scan: 512, tablet: 512,
    explain: 400, idea: 400, wink: 400,
  })
})

test.each(POSES)('pose %s renders a decorative image that reserves its real square', (pose) => {
  const { container } = render(<Lumo pose={pose} />)
  const img = imageOf(container)
  expect(img).toHaveAttribute('src', LUMO_POSES[pose])
  expect(img).toHaveAttribute('alt', '')
  expect(img).toHaveAttribute('aria-hidden', 'true')
  expect(img).toHaveAttribute('data-lumo', pose)
  expect(img).toHaveAttribute('width', String(LUMO_ASSET_PX[pose]))
  expect(img).toHaveAttribute('height', String(LUMO_ASSET_PX[pose]))
})

test('px sets the display size instead of the size presets, and the attributes keep the real edge', () => {
  const { container } = render(<Lumo pose="carry" size="xl" px={112} />)
  const img = imageOf(container)
  expect(img.style.width).toBe('112px')
  expect(img.style.height).toBe('112px')
  expect(img.className).not.toMatch(/\bsize-/)
  expect(img).toHaveAttribute('width', '512')
  expect(img).toHaveAttribute('height', '512')
})

test('without px the size presets still apply and there is no inline size', () => {
  const { container } = render(<Lumo pose="greet" size="xl" />)
  const img = imageOf(container)
  expect(img.className).toContain('size-32')
  expect(img.getAttribute('style')).toBeNull()
})

test('loading can be lazy for pictures far down a page', () => {
  const { container } = render(<Lumo pose="wink" loading="lazy" />)
  expect(imageOf(container)).toHaveAttribute('loading', 'lazy')
})

test('the mascot name is a proper noun outside the dictionaries', () => {
  expect(LUMO_NAME).toBe('Lumo')
})
