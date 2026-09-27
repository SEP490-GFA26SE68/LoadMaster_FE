import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { createFormatter } from '@/lib/format'
import { I18nProvider } from '@/lib/i18n'
import type { DeliveryProgress } from '@/lib/mock-db'
import { RouteDiagram } from './RouteDiagram'
import type { StopRow } from './trip-summary'

const vi = createFormatter('vi-VN')

const STOPS: StopRow[] = [
  { id: 'STOP-01', number: 1, name: 'Công ty TNHH Thực phẩm Sài Gòn', address: '12 Nguyễn Văn Linh', packageCount: 30, weightKg: 390 },
  { id: 'STOP-02', number: 2, name: 'Siêu thị Co.opmart Bình Dương', address: '30 Đại lộ Bình Dương', packageCount: 12, weightKg: 150.5 },
  { id: 'STOP-03', number: 3, name: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K', packageCount: 1, weightKg: 13 },
]

/** Tài xế đã hoàn tất điểm 1, đang dỡ ở điểm 2. */
const DELIVERING: DeliveryProgress = {
  startedAt: '2026-09-14T00:30:00.000Z',
  startedBy: 'US-0004',
  stops: [
    { number: 1, unloadedIds: [], completedAt: '2026-09-14T01:40:00.000Z' },
    { number: 2, unloadedIds: [] },
    { number: 3, unloadedIds: [] },
  ],
  issues: [],
}

function renderDiagram(stops: readonly StopRow[], delivery?: DeliveryProgress) {
  render(<I18nProvider><RouteDiagram stops={stops} delivery={delivery} /></I18nProvider>)
  return screen.getByRole('list', { name: `Kho xuất phát rồi ${stops.length} điểm giao theo thứ tự giao` })
}

test('the depot then every stop, in delivery order, each read out with number, name, packages and weight', () => {
  const list = renderDiagram(STOPS)
  const items = within(list).getAllByRole('listitem')
  expect(items).toHaveLength(STOPS.length + 1)
  expect(items[0]).toHaveTextContent('Kho xuất phát')
  expect(items.slice(1).map((item) => item.querySelector('.sr-only')?.textContent)).toStrictEqual([
    'Điểm 1 / 3: Công ty TNHH Thực phẩm Sài Gòn, 30 kiện, 390 kg',
    'Điểm 2 / 3: Siêu thị Co.opmart Bình Dương, 12 kiện, 150,5 kg',
    'Điểm 3 / 3: Kho Bách Hoá Xanh Dĩ An, 1 kiện, 13 kg',
  ])
  // Trước khi giao: không có dấu hoàn tất hay trạng thái giao
  expect(list).not.toHaveTextContent('Đã giao')
})

test('while delivering: done stops carry the completion time, the next stop is current, later ones pending', () => {
  const list = renderDiagram(STOPS, DELIVERING)
  const [, first, second, third] = within(list).getAllByRole('listitem')
  const time = vi.time('2026-09-14T01:40:00.000Z')
  expect(first!.querySelector('.sr-only')).toHaveTextContent(`Điểm 1 / 3: Công ty TNHH Thực phẩm Sài Gòn, 30 kiện, 390 kg, đã giao lúc ${time}`)
  expect(first).toHaveTextContent(`Đã giao ${time}`)
  expect(second!.querySelector('.sr-only')).toHaveTextContent(/, đang giao$/)
  expect(third!.querySelector('.sr-only')).toHaveTextContent(/, chưa giao$/)
  // Dấu hoàn tất chỉ ở điểm đã giao
  expect(first!.querySelectorAll('svg path')).toHaveLength(1)
  expect(second!.querySelectorAll('svg path')).toHaveLength(0)
})

test('more than six stops keep every stop with its own number, colour cycling after eight', () => {
  const many = Array.from({ length: 9 }, (_, index): StopRow => ({
    id: `STOP-${index + 1}`, number: index + 1, name: `Điểm dừng ${index + 1}`, address: '', packageCount: 2, weightKg: 20,
  }))
  const list = renderDiagram(many)
  const items = within(list).getAllByRole('listitem')
  expect(items).toHaveLength(10)
  const marker = (item: HTMLElement) => item.querySelector<HTMLElement>('[data-stop-marker]')!
  expect(marker(items.at(-1)!)).toHaveTextContent('9')
  expect(marker(items.at(-1)!).style.background).toBe(marker(items[1]!).style.background)
})

test('while delivering, the route card sums up stops delivered, packages unloaded, issues and departure time', () => {
  render(<I18nProvider><RouteDiagram stops={STOPS} delivery={DELIVERING} /></I18nProvider>)
  const summary = screen.getByRole('heading', { name: 'Sơ đồ tuyến' }).closest('summary')!
  expect(summary).toHaveTextContent('Đã giao1 / 3 điểm')
  expect(summary).toHaveTextContent('Đã dỡ0 / 43 kiện')
  expect(summary).toHaveTextContent('Sự cố0')
  expect(summary).toHaveTextContent(`Xuất phát${vi.time(DELIVERING.startedAt)}`)
})
