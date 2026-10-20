import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { installMatchMedia, type MatchMediaControl } from '@/test/match-media'
import { COMPANY_ROLES } from '@/types/user'
import { FEATURE_ROLES, LandingFeatures } from './LandingFeatures'
import { RevealProvider } from './reveal'

/**
 * Lưới "Tính năng chính" (`#tinh-nang`): mỗi ô một tiêu đề nói lợi ích, một câu nói cách làm, hình minh hoạ trang trí. Số trong chữ (số luật
 * nhận hàng, số vai trò) lấy từ code; dải vai trò liệt kê đủ năm vai trò của công ty. jsdom không có IntersectionObserver nên chữ đứng yên.
 */
const LOCALE_KEY = 'loadmaster.ngon-ngu'

let media: MatchMediaControl | null = null

afterEach(() => {
  cleanup()
  media?.restore()
  media = null
  sessionStorage.clear()
})

function renderFeatures(locale: 'vi' | 'en') {
  sessionStorage.setItem(LOCALE_KEY, locale)
  media = installMatchMedia({})
  render(
    <I18nProvider>
      <RevealProvider>
        <LandingFeatures />
      </RevealProvider>
    </I18nProvider>,
  )
}

test('the role strip lists exactly the company roles, in the order a trip travels', () => {
  expect(FEATURE_ROLES).toHaveLength(COMPANY_ROLES.length)
  expect(new Set(FEATURE_ROLES)).toStrictEqual(new Set(COMPANY_ROLES))
})

test('each tile leads with a benefit heading; numbers in the copy come from code', () => {
  renderFeatures('vi')
  const grid = within(screen.getByRole('region', { name: 'Tính năng chính' }))
  expect(grid.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toStrictEqual([
    'Xếp đúng thứ tự giao ngay từ kho',
    'So ba phương án rồi mới duyệt',
    'Biết chắc từng kiện đã lên xe',
    'Biết xe đang ở đâu, điểm nào có nguy cơ trễ',
    'Xe đang chạy vẫn nhận thêm hàng',
    '5 vai trò, mỗi người một màn phù hợp',
  ])
  // Nguyên tắc vùng điểm giao giải thích đủ một lần, ở ô xếp hàng
  expect(grid.getAllByText(/vùng của điểm cuối nằm sâu nhất/)).toHaveLength(1)
  expect(grid.getByText(/^Kiểm 10 luật trước khi duyệt;/)).toBeInTheDocument()

  const roles = grid.getAllByRole('list').find((list) => within(list).queryByText('Quản trị công ty'))
  if (!roles) throw new Error('Không có dải vai trò')
  // Mỗi dòng: tên vai trò rồi một câu nói vai trò đó làm gì
  const names = ['Điều phối viên', 'Nhân viên kho', 'Tài xế', 'Quản lý công ty', 'Quản trị công ty']
  const items = within(roles).getAllByRole('listitem')
  expect(items).toHaveLength(names.length)
  items.forEach((item, index) => expect(item.textContent?.startsWith(names[index] ?? '')).toBe(true))

  // Ba phương án dùng đúng tên mục tiêu của ứng dụng; hình thu nhỏ của từng phương án chỉ là trang trí
  const plans = grid.getAllByRole('list').find((list) => within(list).queryByText('Tối đa thể tích'))
  if (!plans) throw new Error('Không có danh sách phương án')
  expect(within(plans).getAllByRole('listitem')).toHaveLength(3)
  for (const strip of plans.querySelectorAll('svg')) expect(strip).toHaveAttribute('aria-hidden', 'true')
})

test('decorative step chips and the pickup drawing stay out of the accessibility tree', () => {
  renderFeatures('vi')
  const grid = within(screen.getByRole('region', { name: 'Tính năng chính' }))
  for (const step of ['Soạn hàng', 'Xếp hàng', 'Dỡ hàng']) {
    expect(grid.getByText(step).closest('[aria-hidden="true"]')).not.toBeNull()
  }
})

test('English copy uses sentence case and the same numbers', () => {
  renderFeatures('en')
  const grid = within(screen.getByRole('region', { name: 'Key features' }))
  expect(grid.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toStrictEqual([
    'Load in delivery order, right from the warehouse',
    'Compare three plans before you approve',
    'Know every package made it on board',
    'See where each truck is and which stops may be late',
    'Take on more cargo mid-route',
    '5 company roles, each with the right screen',
  ])
  expect(grid.getByText(/^Checks 10 rules before approval;/)).toBeInTheDocument()
  expect(grid.queryByText(/ and and /)).not.toBeInTheDocument()
})
