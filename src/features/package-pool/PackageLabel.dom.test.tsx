import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { Package } from '@/lib/mock-db'
import { PackageLabel } from './PackageLabel'
import type { PackageLabel as PackageLabelData } from './package-pool-api'

/** Nhãn in của kiện theo mẫu mới (FE-3b-05, D-71): đủ trường, dòng "Hàng dễ vỡ" chỉ với kiện `FRAGILE`, bản in theo khổ 93 × 134 mm. */

const pkg = (overrides: Partial<Package> = {}): Package => ({
  id: 'PK-0054', companyId: 'LOG-001', packageCode: 'PB-HUE-2609-01', qrToken: 'LM-7K3F-9XQ2-M4TD', lengthCm: 50, widthCm: 40, heightCm: 30, weightKg: 9.5,
  handlingClass: 'FRAGILE', destination: 'KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế', status: 'IMPORTED', flags: [], source: 'IMPORT',
  createdAt: '2026-09-13T09:20:00.000Z', createdBy: 'US-0001', history: [], ...overrides,
})

const OWNER = { id: 'LOG-001', name: 'Công ty TNHH Vận tải Long Bình', address: '', phone: '', depot: { name: '', address: '', lat: 0, lng: 0 } }

function renderLabel(label: PackageLabelData, print = false) {
  render(<I18nProvider><PackageLabel label={label} print={print} /></I18nProvider>)
  return screen.getByRole('article', { name: label.package.id })
}

test('a label carries the QR code with its token, the sender code, handling class, size in cm, weight in kg, destination and the mono logo', () => {
  const label = renderLabel({ package: pkg(), type: undefined, owner: OWNER })
  expect(within(label).getByRole('img', { name: 'Mã QR LM-7K3F-9XQ2-M4TD' })).toBeInTheDocument()
  // Mã chữ in dưới hình QR để gõ tay khi không quét được
  expect(within(label).getByText('LM-7K3F-9XQ2-M4TD')).toBeInTheDocument()
  for (const [name, value] of [
    ['Mã bên gửi', 'PB-HUE-2609-01'], ['Loại hàng', 'Dễ vỡ'], ['Kích thước', '50 × 40 × 30 cm'], ['Khối lượng', '9,5 kg'],
    ['Điểm đến', 'KCN Phú Bài, TX. Hương Thuỷ, Thừa Thiên Huế'],
  ]) expect(within(label).getByText(name ?? '').parentElement).toHaveTextContent(`${name}${value}`)
  expect(within(label).getByText('PK-0054')).toBeInTheDocument()
  expect(within(label).getByText('LoadMaster')).toBeInTheDocument()
  // Logo một màu theo `currentColor`: in đen trắng vẫn rõ
  expect(label.querySelector('header svg .fill-current')).not.toBeNull()
  expect(within(label).getByText('Công ty TNHH Vận tải Long Bình')).toBeInTheDocument()
  // Kiện dễ vỡ có dòng cảnh báo
  expect(within(label).getByText('Hàng dễ vỡ')).toBeInTheDocument()
})

test('only fragile packages carry the warning line; long codes and destinations wrap instead of being cut', () => {
  const destination = 'Kho trung chuyển số 3, Lô C12-C14 đường N4, Khu công nghiệp Việt Nam – Singapore II-A, phường Vĩnh Tân, thành phố Tân Uyên, tỉnh Bình Dương'
  const label = renderLabel({ package: pkg({ handlingClass: 'REFRIGERATED', packageCode: 'VSIP2A-KHO3-LOC12-DOT-2609-KIEN-000187', destination }), type: undefined, owner: OWNER })
  expect(within(label).queryByText('Hàng dễ vỡ')).not.toBeInTheDocument()
  expect(within(label).getByText('Hàng lạnh')).toBeInTheDocument()
  for (const text of [destination, 'VSIP2A-KHO3-LOC12-DOT-2609-KIEN-000187']) {
    const node = within(label).getByText(text)
    expect(node).toHaveClass('wrap-anywhere')
    expect(node.className).not.toMatch(/truncate|line-clamp/)
  }
})

test('the printed label is 93 × 134 mm with a 4 mm base size; the on-screen one keeps the same proportions without a fixed height', () => {
  const printed = renderLabel({ package: pkg({ id: 'PK-0055' }), type: undefined, owner: OWNER }, true)
  expect(printed.style.fontSize).toBe('4mm')
  // 93 mm / 4 mm = 23,25 em; 134 mm / 4 mm = 33,5 em
  expect([printed.style.width, printed.style.height]).toStrictEqual(['23.25em', '33.5em'])
  const onScreen = renderLabel({ package: pkg({ id: 'PK-0056' }), type: undefined, owner: OWNER })
  expect([onScreen.style.width, onScreen.style.height, onScreen.style.fontSize]).toStrictEqual(['23.25em', '', ''])
})
