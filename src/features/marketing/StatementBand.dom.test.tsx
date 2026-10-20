import { cleanup, render } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { installFakeIntersectionObserver, type FakeIntersectionObserverControl } from '@/test/intersection-observer'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { RevealProvider } from './reveal'
import { StatementBand } from './StatementBand'

/**
 * Dải nguyên tắc xếp hàng của trang giới thiệu (AGENTS mục 1): câu đọc được nguyên văn, hình xe tải là trang trí (`aria-hidden`) với bốn khối
 * hàng có số điểm giao, xếp 4 · 3 · 2 · 1 từ cabin ra cửa sau, nhãn "Cửa sau" ở cửa. jsdom không có IntersectionObserver nên dải tĩnh; test
 * chuyển động cài observer giả và `matchMedia`.
 */
const STATEMENT = 'Hàng giao sau lên xe trước. Hàng giao trước nằm sát cửa. Tới điểm nào, lấy hàng điểm đó.'

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

/** Hình xe của dải: SVG duy nhất trong dải, cùng nhãn cửa nằm trong một khối `aria-hidden` (không gồm câu). */
function truckOf(container: HTMLElement): { svg: SVGSVGElement; picture: HTMLElement } {
  const svgs = container.querySelectorAll<SVGSVGElement>('.lp-statement svg')
  expect(svgs).toHaveLength(1)
  const [svg] = svgs
  const picture = svg?.parentElement
  if (!svg || !picture) throw new Error('Không có hình xe')
  expect(picture).toHaveAttribute('aria-hidden', 'true')
  expect(picture.querySelector('p')).toBeNull()
  return { svg, picture }
}

/** Bốn khối hàng theo thứ tự trong hình: số điểm giao, mép trái và mép phải của khối (đơn vị của khung hình). */
function blocksOf(svg: SVGSVGElement) {
  return [...svg.querySelectorAll<SVGGElement>('[data-stop]')].map((block) => {
    const rect = block.querySelector('rect')
    const x = Number(rect?.getAttribute('x'))
    return { stop: block.getAttribute('data-stop'), x, right: x + Number(rect?.getAttribute('width')), label: block.textContent }
  })
}

test('statically the sentence reads whole and the truck is decorative: four numbered blocks 4 · 3 · 2 · 1 from cab to rear door', () => {
  const { container } = renderBand()
  const band = container.querySelector<HTMLElement>('.lp-statement')
  expect(band?.querySelector('p')).toHaveTextContent(STATEMENT)
  expect(band?.querySelector('.lp-statement-word')).toBeNull()

  const { svg, picture } = truckOf(container)
  const blocks = blocksOf(svg)
  expect(blocks.map(({ stop, label }) => [stop, label])).toStrictEqual([
    ['4', '4'],
    ['3', '3'],
    ['2', '2'],
    ['1', '1'],
  ])
  // Hàng giao sau nằm sâu (gần cabin, bên trái), hàng giao trước sát cửa sau (bên phải)
  const xs = blocks.map(({ x }) => x)
  expect(xs.every((x, index) => index === 0 || x > (xs[index - 1] ?? Infinity))).toBe(true)
  // Nhãn cửa là chữ HTML trên hình, đứng sau mép phải của khối sát cửa
  const door = picture.querySelector<HTMLElement>('[data-door]')
  expect(door).toHaveTextContent(/^Cửa sau$/)
  const viewWidth = Number(svg.getAttribute('viewBox')?.split(' ')[2])
  expect(Number.parseFloat(door?.style.left ?? '')).toBeGreaterThan((100 * (blocks.at(-1)?.right ?? Infinity)) / viewWidth)
  // Tĩnh: không lớp chuyển động nào, đủ bốn khối tại chỗ
  expect(svg.querySelector('.lp-load')).toBeNull()
})

test('with motion each block loads through the rear door on the scroll of the band: block 4 first, block 1 last; the sentence stays readable', () => {
  io = installFakeIntersectionObserver()
  media = installMatchMedia({ '(prefers-reduced-motion: reduce)': false })
  const { container } = renderBand()
  const band = container.querySelector<HTMLElement>('.lp-statement')
  // Hai bản ở lại suốt (theo cuộn, không bao giờ xong): bản cho trình đọc màn hình không chọn được, chép câu chỉ được một lần
  expect(band?.querySelector('.sr-only')).toHaveTextContent(STATEMENT)
  expect(band?.querySelector('.sr-only')).toHaveClass('select-none')
  expect(band?.querySelectorAll('.lp-statement-word').length).toBeGreaterThan(10)

  const { svg } = truckOf(container)
  const loads =[...svg.querySelectorAll<SVGGElement>('[data-stop]')].map((block) => [
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
})
