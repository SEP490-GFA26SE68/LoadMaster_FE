import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { installFakeIntersectionObserver, type FakeIntersectionObserverControl } from '@/test/intersection-observer'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { RevealProvider } from './reveal'
import { StatementBand } from './StatementBand'

/**
 * Dải nguyên tắc xếp hàng của trang giới thiệu (AGENTS mục 1): dòng mở và câu đọc được nguyên văn, hình xe tải là trang trí (`aria-hidden`):
 * đầu xe bên phải, cửa sau bên trái, bốn khối hàng có số điểm giao xếp 4 · 3 · 2 · 1 từ cabin ra cửa sau, nhãn "Cửa sau" ở cửa; dải chữ trôi
 * đọc được một lần qua danh sách ẩn. jsdom không có IntersectionObserver nên dải tĩnh: xe đủ hàng, cửa đóng, đứng yên, không khói. Test
 * chuyển động cài observer giả và `matchMedia`.
 */
const KICKER = 'Nguyên tắc xếp hàng'
const STATEMENT = 'Hàng giao sau lên xe trước. Hàng giao trước nằm sát cửa. Tới điểm nào, lấy hàng điểm đó.'
const RIBBON = 'Việc LoadMaster lo trong một chuyến'
const PHRASES = [
  'Xếp 3D theo thứ tự dỡ',
  'Đối chiếu từng kiện bằng mã QR',
  'Tối ưu tuyến, tính giờ đến',
  'Duyệt phương án trước khi xếp',
  'Ước lượng tải trục trước và sau',
  'Nhận hàng dọc đường',
  'Giám sát chuyến đang chạy',
  'Báo cáo sau mỗi chuyến',
]
/** Lớp chuyển động của xe: không lớp nào được có mặt khi dải tĩnh. */
const MOTION_CLASSES = '.lp-load, .lp-door, .lp-doorway, .lp-drive, .lp-bob, .lp-spin, .lp-dash, .lp-smoke, [data-puff]'

let io: FakeIntersectionObserverControl | null = null
let media: MatchMediaControl | null = null

afterEach(() => {
  cleanup()
  io?.restore()
  media?.restore()
  io = null
  media = null
})

function renderBand() {
  return render(
    <I18nProvider>
      <RevealProvider>
        <StatementBand />
      </RevealProvider>
    </I18nProvider>,
  )
}

function motionOn() {
  io = installFakeIntersectionObserver()
  media = installMatchMedia({ '(prefers-reduced-motion: reduce)': false })
  return io
}

/** Hình xe của dải: khối `aria-hidden` không chứa chữ của câu; lớp xe (`data-vehicle`) mang SVG của thân xe. */
function truckOf(container: HTMLElement) {
  const picture = container.querySelector<HTMLElement>('.lp-statement .lp-truck')
  if (!picture) throw new Error('Không có hình xe')
  expect(picture).toHaveAttribute('aria-hidden', 'true')
  expect(picture.querySelector('p')).toBeNull()
  const vehicle = picture.querySelector<HTMLElement>('[data-vehicle]')
  const svg = vehicle?.querySelector<SVGSVGElement>('svg')
  if (!vehicle || !svg) throw new Error('Không có lớp xe')
  return { picture, vehicle, svg }
}

/** Bốn khối hàng theo thứ tự trong hình: số điểm giao, mép trái và mép phải của khối (đơn vị của khung hình). */
function blocksOf(svg: SVGSVGElement) {
  return [...svg.querySelectorAll<SVGGElement>('[data-stop]')].map((block) => {
    const rect = block.querySelector('rect')
    const x = Number(rect?.getAttribute('x'))
    return { stop: block.getAttribute('data-stop'), x, right: x + Number(rect?.getAttribute('width')), label: block.textContent }
  })
}

test('statically the kicker and sentence read whole, the ribbon is one list, and the truck stands loaded: door shut, no smoke, no motion', () => {
  const { container } = renderBand()
  const band = container.querySelector<HTMLElement>('.lp-statement')
  if (!band) throw new Error('Không có dải')
  expect(screen.getByText(KICKER).tagName).toBe('P')
  const sentence = [...band.querySelectorAll('p')].find((p) => p.textContent?.startsWith('Hàng giao sau'))
  expect(sentence).toHaveTextContent(STATEMENT)
  // Mỗi câu một dòng, cả khi tĩnh: bật chuyển động không đổi bố cục
  expect(sentence?.querySelectorAll('.reveal-line')).toHaveLength(3)
  expect(band.querySelector('.lp-statement-word, [data-lines], [data-flow]')).toBeNull()

  const list = screen.getByRole('list', { name: RIBBON })
  expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toStrictEqual(PHRASES)

  const { picture, svg } = truckOf(container)
  const blocks = blocksOf(svg)
  expect(blocks.map(({ stop, label }) => [stop, label])).toStrictEqual([
    ['4', '4'],
    ['3', '3'],
    ['2', '2'],
    ['1', '1'],
  ])
  // Đầu xe bên phải: hàng giao sau nằm sâu (gần cabin, bên phải), hàng giao trước sát cửa sau (bên trái)
  const xs = blocks.map(({ x }) => x)
  expect(xs.every((x, index) => index === 0 || x < (xs[index - 1] ?? -Infinity))).toBe(true)
  // Nhãn cửa là chữ HTML trên hình, đứng trước mép trái của khối sát cửa
  const door = picture.querySelector<HTMLElement>('[data-door]')
  expect(door).toHaveTextContent(/^Cửa sau$/)
  const viewWidth = Number(svg.getAttribute('viewBox')?.split(' ')[2])
  expect(Number.parseFloat(door?.style.left ?? '')).toBeLessThan((100 * (blocks.at(-1)?.x ?? -Infinity)) / viewWidth)
  // Cửa cuốn đã đóng, ba bánh, không lớp chuyển động, không khói
  expect(svg.querySelector('[data-door-panel]')).not.toBeNull()
  expect(svg.querySelectorAll('[data-wheel]')).toHaveLength(3)
  expect(picture.querySelector(MOTION_CLASSES)).toBeNull()
})

test('with motion the sentence rises line by line and lights word by word; the truck loads 4 → 1, shuts the door and drives off with smoke', () => {
  const control = motionOn()
  const { container } = renderBand()
  const band = container.querySelector<HTMLElement>('.lp-statement')
  if (!band) throw new Error('Không có dải')

  // Câu: một bản sr-only không chọn được và ba dòng aria-hidden, từ sáng dần theo cuộn với --p từ 0 tới 1 qua cả ba dòng
  const sentence = band.querySelector<HTMLElement>('[data-lines]')?.parentElement
  if (!sentence) throw new Error('Không có câu')
  expect(within(sentence).getByText(STATEMENT)).toHaveClass('sr-only', 'select-none')
  const lines = sentence.querySelectorAll('[aria-hidden="true"] .reveal-line-inner')
  expect(lines).toHaveLength(3)
  const lit = [...sentence.querySelectorAll<HTMLElement>('.lp-statement-word')].map((word) => Number(word.style.getPropertyValue('--p')))
  expect(lit.length).toBeGreaterThan(10)
  expect(lit[0]).toBe(0)
  expect(lit.at(-1)).toBe(1)
  expect(lit.every((p, index) => index === 0 || p > (lit[index - 1] ?? Infinity))).toBe(true)
  // Dòng mở chảy từng chữ, đọc được một lần
  expect(screen.getByText(KICKER)).toHaveClass('sr-only')
  expect(band.querySelectorAll('[data-flow] .reveal-flow-char').length).toBe(KICKER.replace(/\s/g, '').length)

  const { picture, vehicle, svg } = truckOf(container)
  // Hình tự làm cổng: trình duyệt thiếu view timeline chạy chuỗi theo thời gian khi hình lộ ra
  expect(picture).toHaveAttribute('data-reveal-gate')
  control.trigger(picture)
  expect(picture).toHaveAttribute('data-shown')
  const loads = [...svg.querySelectorAll<SVGGElement>('[data-stop]')].map((block) => [
    block.getAttribute('data-stop'),
    block.classList.contains('lp-load'),
    block.style.getPropertyValue('--q'),
  ])
  expect(loads).toStrictEqual([
    ['4', true, '0.000'],
    ['3', true, '0.333'],
    ['2', true, '0.667'],
    ['1', true, '1.000'],
  ])
  // Khối vào từ cửa sau bên trái: quãng trượt âm
  expect(svg.querySelector<SVGGElement>('[data-stop="1"]')?.style.getPropertyValue('--load-x')).toMatch(/^-\d+px$/)
  expect(svg.querySelector('[data-door-panel]')).toHaveClass('lp-door')
  expect(svg.querySelector('.lp-doorway')).not.toBeNull()
  // Lớp xe (cả nhãn cửa) chạy đi, thân nhún, ba bánh quay; vạch kẻ đường đứng ngoài lớp xe và trôi
  expect(vehicle).toHaveClass('lp-drive')
  expect(vehicle.querySelector('[data-door]')).not.toBeNull()
  expect(svg.querySelector('.lp-bob')).not.toBeNull()
  expect(svg.querySelectorAll('[data-wheel].lp-spin')).toHaveLength(3)
  const road = picture.querySelector('[data-road]')
  expect(road).toHaveClass('lp-dash')
  expect(vehicle.contains(road)).toBe(false)
  // Khói: hai cụm lúc nổ máy, bốn cụm lúc lăn bánh, bay ra sau (bên trái) của xe; nằm ở lớp mặt đường nên ở lại khi xe chạy đi
  const puffs = [...picture.querySelectorAll<SVGCircleElement>('[data-puff]')]
  expect(puffs.some((puff) => vehicle.contains(puff))).toBe(false)
  expect(puffs.map((puff) => [puff.classList.contains('lp-puff') ? 'puff' : 'trail', puff.style.getPropertyValue('--k')])).toStrictEqual([
    ['puff', '0'],
    ['puff', '1'],
    ['trail', '0'],
    ['trail', '1'],
    ['trail', '2'],
    ['trail', '3'],
  ])
  expect(puffs.every((puff) => puff.classList.contains('lp-smoke'))).toBe(true)
  expect(puffs[0]?.parentElement?.style.getPropertyValue('--puff-dir')).toBe('-1')

  // Dải chữ trôi: danh sách ẩn đọc mỗi cụm một lần, các bản lặp nằm trong khối aria-hidden
  const list = screen.getByRole('list', { name: RIBBON })
  expect(within(list).getAllByRole('listitem')).toHaveLength(PHRASES.length)
  expect(band.querySelectorAll('[aria-hidden="true"] .reveal-ribbon-item').length).toBeGreaterThan(PHRASES.length)
  const tracks = [...band.querySelectorAll<HTMLElement>('.reveal-ribbon-track')]
  expect(tracks.map((track) => track.getAttribute('data-dir'))).toStrictEqual(['left', 'right'])
  expect(tracks.every((track) => track.closest('[aria-hidden="true"]'))).toBe(true)
})
