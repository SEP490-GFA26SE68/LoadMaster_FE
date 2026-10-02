import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { stopColor } from '@/lib/stops'
import { RouteMap } from './RouteMap'

/** jsdom không có WebGL: `RouteMap` vẽ sơ đồ SVG và không tải chunk MapLibre (FE-4b-07). */
const DEPOT = { name: 'Kho Long Bình', lat: 10.9294, lng: 106.8747 }
/** Thứ tự đi: điểm 4 rồi điểm 3 — số trên mốc là số định danh điểm giao, không phải thứ tự trong mảng. */
const STOPS = [
  { id: 'STOP-04', number: 4, name: 'Nhà thuốc Long Châu Biên Hoà', lat: 10.947, lng: 106.824 },
  { id: 'STOP-03', number: 3, name: 'Kho Bách Hoá Xanh Dĩ An', lat: 10.8935, lng: 106.783 },
]

function renderMap(props: Partial<Parameters<typeof RouteMap>[0]> = {}, locale?: 'en') {
  if (locale) window.history.replaceState(null, '', `/?lang=${locale}`)
  render(<I18nProvider><RouteMap label="Bản đồ tuyến TRIP-2026-0914" depot={DEPOT} stops={STOPS} {...props} /></I18nProvider>)
  return screen.getByRole('region', { name: 'Bản đồ tuyến TRIP-2026-0914' })
}

test('without WebGL the route is an SVG sketch: depot, numbered stops in their stop colours, and the route line', () => {
  const region = renderMap()
  const sketch = region.querySelector('svg[data-route-sketch]')
  expect(sketch).toBeInTheDocument()
  expect(sketch).toHaveAttribute('aria-hidden', 'true')
  expect(region.querySelector('canvas')).toBeNull()

  expect(sketch?.querySelectorAll('[data-marker="depot"]')).toHaveLength(1)
  const stops = [...(sketch?.querySelectorAll('[data-marker="stop"]') ?? [])]
  expect(stops.map((stop) => stop.textContent)).toStrictEqual(['4', '3'])
  expect(stops.map((stop) => stop.querySelector('circle')?.getAttribute('fill'))).toStrictEqual([stopColor(4), stopColor(3)])
  // kho + hai điểm = ba đỉnh
  expect(sketch?.querySelector('[data-route-line]')?.getAttribute('points')?.split(' ')).toHaveLength(3)
  expect(sketch?.querySelector('[data-marker="vehicle"]')).toBeNull()
})

test('screen readers get the same points as a list, in visiting order', () => {
  const region = renderMap({ vehicle: { name: '60C-123.45', lat: 10.92, lng: 106.85 } })
  const items = within(within(region).getByRole('list', { name: 'Các điểm trên bản đồ, theo thứ tự đi' })).getAllByRole('listitem')
  expect(items.map((item) => item.textContent)).toStrictEqual([
    'Kho xuất phát: Kho Long Bình',
    'Điểm 4: Nhà thuốc Long Châu Biên Hoà',
    'Điểm 3: Kho Bách Hoá Xanh Dĩ An',
    'Vị trí xe: 60C-123.45',
  ])
  expect(region.querySelectorAll('[data-marker="vehicle"]')).toHaveLength(1)
})

test('a route without a depot starts at the first stop; one stop alone has no line', () => {
  const region = renderMap({ depot: undefined })
  expect(region.querySelector('[data-marker="depot"]')).toBeNull()
  expect(region.querySelector('[data-route-line]')?.getAttribute('points')?.split(' ')).toHaveLength(2)
  expect(within(region).getAllByRole('listitem')).toHaveLength(2)
})

test('one stop and no depot: a single marker, no line', () => {
  const region = renderMap({ depot: undefined, stops: STOPS.slice(0, 1) })
  expect(region.querySelectorAll('[data-marker="stop"]')).toHaveLength(1)
  expect(region.querySelector('[data-route-line]')).toBeNull()
})

test('the list is translated', () => {
  const region = renderMap({}, 'en')
  const items = within(within(region).getByRole('list', { name: 'Points on the map, in visiting order' })).getAllByRole('listitem')
  expect(items[0]).toHaveTextContent('Departure depot: Kho Long Bình')
  expect(items[1]).toHaveTextContent('Stop 4: Nhà thuốc Long Châu Biên Hoà')
})
