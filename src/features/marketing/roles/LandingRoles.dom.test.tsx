import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { LandingRoles } from './LandingRoles'
import { roleRoute } from './roles-model'

/**
 * "Một chuyến, bốn màn": bốn vai trò trong một nhóm tab, mỗi tab một hình màn thật (`aria-hidden`) kèm bản chữ tương đương. Chip mức hạn
 * trong hình điều phối viên là kết quả `@/domain/routing` trên tuyến mẫu, không đặt tay.
 */
const ROLES = ['Điều phối viên', 'Nhân viên kho', 'Tài xế', 'Quản lý công ty'] as const
const DEADLINE_LABELS = { OK: 'Kịp hạn', AT_RISK: 'Sát hạn', MISSED: 'Trễ hạn dự kiến' } as const
const MOBILE_APP = 'Tài xế và nhân viên kho còn có ứng dụng di động riêng — chưa lên cửa hàng ứng dụng.'

function renderRoles() {
  render(
    <I18nProvider>
      <LandingRoles />
    </I18nProvider>,
  )
  return screen.getByRole('region', { name: 'Một chuyến, bốn màn' })
}

/** Hình thiết bị của một bảng: phần tử `aria-hidden` bọc khung màn. */
function frameOf(panel: HTMLElement): HTMLElement {
  const frame = panel.querySelector('.roles-screen')?.closest<HTMLElement>('[aria-hidden="true"]')
  if (!frame) throw new Error('Bảng không có hình thiết bị')
  return frame
}

afterEach(cleanup)

test('four roles of one trip are tabs with their role names; the dispatcher is open first and the arrow keys move between tabs', async () => {
  const user = userEvent.setup()
  const section = within(renderRoles())
  const tablist = section.getByRole('tablist', { name: 'Vai trò trong một chuyến' })
  const tabs = within(tablist).getAllByRole('tab')
  expect(tabs.map((tab) => tab.textContent)).toStrictEqual([...ROLES])
  expect(section.getByRole('tab', { name: 'Điều phối viên' })).toHaveAttribute('aria-selected', 'true')
  expect(section.getByRole('tabpanel', { name: 'Điều phối viên' })).toHaveAttribute('data-state', 'active')

  await user.click(section.getByRole('tab', { name: 'Tài xế' }))
  expect(section.getByRole('tab', { name: 'Tài xế' })).toHaveAttribute('aria-selected', 'true')
  expect(section.getByRole('tabpanel', { name: 'Tài xế' })).toHaveAttribute('data-state', 'active')
  expect(section.getByRole('tabpanel', { name: 'Điều phối viên' })).toHaveAttribute('data-state', 'inactive')

  await user.keyboard('{ArrowRight}')
  expect(section.getByRole('tab', { name: 'Quản lý công ty' })).toHaveFocus()
  expect(section.getByRole('tab', { name: 'Quản lý công ty' })).toHaveAttribute('aria-selected', 'true')
})

test('every frame is a picture with a text equivalent; the driver tab says there is a mobile app, without a store badge, link or MOCK RESULT', async () => {
  const user = userEvent.setup()
  const region = renderRoles()
  const section = within(region)
  for (const role of ROLES) {
    const panel = section.getByRole('tabpanel', { name: role })
    expect(frameOf(panel)).toBeInTheDocument()
    expect(panel.querySelector('.sr-only')?.textContent).toMatch(/^Hình minh hoạ /)
  }
  await user.click(section.getByRole('tab', { name: 'Tài xế' }))
  expect(within(section.getByRole('tabpanel', { name: 'Tài xế' })).getByText(MOBILE_APP)).toBeInTheDocument()
  expect(section.getAllByText(MOBILE_APP)).toHaveLength(1)
  expect(section.queryByRole('link')).not.toBeInTheDocument()
  expect(region.querySelector('img')).toBeNull()
  expect(region).not.toHaveTextContent(/MOCK/)
  // Trong hình không có nút bấm được — nút của màn thật chỉ là hình
  expect(region.querySelectorAll('button:not([role="tab"])')).toHaveLength(0)
  expect(section.getByText('Số trong hình tính từ chuyến mẫu 366 kiện; giờ đến theo đường nối thẳng, xe rời kho lúc 05:00.')).toBeInTheDocument()
})

test('the dispatcher frame shows the deadline chips that @/domain/routing computes for the sample route, the simulated source and the rests', () => {
  const route = roleRoute()
  const expected = route.stops.map((stop) => DEADLINE_LABELS[stop.status])
  // Tuyến mẫu được chọn để có đủ ba mức hạn
  expect(expected).toStrictEqual(['Kịp hạn', 'Sát hạn', 'Kịp hạn', 'Trễ hạn dự kiến'])

  const panel = within(renderRoles()).getByRole('tabpanel', { name: 'Điều phối viên' })
  const frame = within(frameOf(panel))
  expect(frame.getAllByText(/^(Kịp hạn|Sát hạn|Trễ hạn dự kiến)$/).map((chip) => chip.textContent)).toStrictEqual(expected)
  expect(frame.getByText('Mô phỏng')).toBeInTheDocument()
  expect(frame.getByText(`đã gồm ${route.restCount} lần nghỉ bắt buộc (15 phút)`)).toBeInTheDocument()

  // Bản chữ tương đương nói cùng các mức hạn, theo thứ tự điểm giao
  const items = within(panel).getAllByRole('listitem').filter((item) => item.closest('.sr-only'))
  expect(items.map((item) => item.textContent?.split(' — ').at(-1))).toStrictEqual(expected.map((label) => `${label}.`))
})
