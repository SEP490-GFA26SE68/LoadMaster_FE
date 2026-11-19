import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { EmptyState } from '@/components/EmptyState'
import { Lumo, LUMO_ASSET_PX, LUMO_HALF_POSES, LUMO_NAME, LUMO_POSES, lumoSrcSet, type LumoPose } from './Lumo'

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

/** Bản nửa cạnh cho màn 1× và ảnh nhỏ: cỡ đặt sẵn tự có `srcset` + `sizes`; `px` chỉ có khi nơi gọi đưa `sizes`. */
test('every pose has its own half-edge picture, offered next to the original', () => {
  const halves = Object.values(LUMO_HALF_POSES)
  expect(Object.keys(LUMO_HALF_POSES)).toStrictEqual(POSES)
  expect(new Set([...halves, ...Object.values(LUMO_POSES)]).size).toBe(halves.length * 2)
  expect(lumoSrcSet('carry')).toBe(`${LUMO_HALF_POSES.carry} 256w, ${LUMO_POSES.carry} 512w`)
  expect(lumoSrcSet('greet')).toBe(`${LUMO_HALF_POSES.greet} 160w, ${LUMO_POSES.greet} 320w`)
})

test('size presets tell the browser their display size so it can pick the half-edge picture', () => {
  const img = imageOf(render(<Lumo pose="greet" size="xl" />).container)
  expect(img).toHaveAttribute('srcset', lumoSrcSet('greet'))
  expect(img).toHaveAttribute('sizes', '(min-width: 640px) 160px, 128px')
  expect(img).toHaveAttribute('src', LUMO_POSES.greet)
  expect(imageOf(render(<Lumo pose="done" size="sm" />).container)).toHaveAttribute('sizes', '96px')
})

test('a px size offers the half-edge picture only with sizes, so a page that preloads the original does not load twice', () => {
  const plain = imageOf(render(<Lumo pose="scan" px={96} />).container)
  expect(plain).not.toHaveAttribute('srcset')
  expect(plain).not.toHaveAttribute('sizes')
  const hinted = imageOf(render(<Lumo pose="scan" px={96} sizes="96px" />).container)
  expect(hinted).toHaveAttribute('srcset', lumoSrcSet('scan'))
  expect(hinted).toHaveAttribute('sizes', '96px')
})

test('loading can be lazy for pictures far down a page', () => {
  const { container } = render(<Lumo pose="wink" loading="lazy" />)
  expect(imageOf(container)).toHaveAttribute('loading', 'lazy')
})

test('the mascot name is a proper noun outside the dictionaries', () => {
  expect(LUMO_NAME).toBe('Lumo')
})
