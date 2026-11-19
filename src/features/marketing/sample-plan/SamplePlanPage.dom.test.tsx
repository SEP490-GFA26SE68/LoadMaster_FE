import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { expandPackages } from '@/domain/cargo'
import type { CandidatePlan } from '@/services/optimization'
import { I18nProvider } from '@/lib/i18n'
import { runLandingSample } from '../landing-sample-api'
import { LANDING_REQUEST } from '../landing-sample.mock'
import { SamplePlanPage } from './SamplePlanPage'

/**
 * Trang công khai `/phuong-an-mau` với bộ tối ưu mô phỏng thật (chuyến mẫu 366 kiện, chạy một lần cho cả tệp). jsdom không có WebGL nên
 * khung 3D là hình minh hoạ — phần còn lại của trang (bộ chọn, bảng số, URL, chia sẻ) vẫn dùng được.
 */
let sample: readonly CandidatePlan[]
beforeAll(async () => {
  sample = await runLandingSample()
}, 30_000)

const navigatorShare = Object.getOwnPropertyDescriptor(navigator, 'share')
const navigatorClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
afterEach(() => {
  for (const [key, descriptor] of [['share', navigatorShare], ['clipboard', navigatorClipboard]] as const) {
    if (descriptor) Object.defineProperty(navigator, key, descriptor)
    else Reflect.deleteProperty(navigator, key)
  }
})

function setNavigator(key: 'share' | 'clipboard', value: unknown) {
  Object.defineProperty(navigator, key, { configurable: true, writable: true, value })
}

function Search() {
  return <output data-testid="search">{useLocation().search}</output>
}

function renderPage(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  client.setQueryData(['landing', 'sample-candidates'], sample)
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/phuong-an-mau" element={<><SamplePlanPage /><Search /></>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const search = () => screen.getByTestId('search').textContent
/** Số kiện của điểm `stop` có chỗ trong phương án — đếm thẳng từ yêu cầu mẫu và các chỗ xếp. */
function stopCount(plan: CandidatePlan, stop: number) {
  const ids = new Set(expandPackages(LANDING_REQUEST.packages).instances.filter((i) => i.deliveryStop === stop).map((i) => i.packageInstanceId))
  return plan.result.placements.filter((p) => ids.has(p.packageInstanceId)).length
}

test('a shared link opens plan B unloading at stop 2: illustration without WebGL, the stop figures, no MOCK RESULT', async () => {
  setNavigator('share', undefined)
  setNavigator('clipboard', undefined)
  renderPage('/phuong-an-mau?phuong-an=b&che-do=do&diem=2')

  expect(screen.getByRole('heading', { level: 1, name: 'Phương án mẫu' })).toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Về trang giới thiệu' })).toHaveAttribute('href', '/gioi-thieu')
  // Không WebGL: hình minh hoạ kèm câu nói vì sao, không góc nhìn nào
  expect(screen.getByRole('img', { name: 'Mô phỏng thùng xe được xếp hàng theo thứ tự dỡ' })).toBeInTheDocument()
  expect(screen.getByText(/không vẽ được khung 3D/)).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Góc nhìn' })).not.toBeInTheDocument()

  expect(screen.getByRole('button', { name: 'Phương án B — Cân bằng tải trục' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Dỡ hàng' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Điểm 2 · Cửa hàng tiện lợi' })).toHaveAttribute('aria-pressed', 'true')

  const planB = sample.find((plan) => plan.objective === 'AXLE_BALANCE')!
  const stop = screen.getByRole('region', { name: 'Ở điểm 2 · Cửa hàng tiện lợi' })
  expect(within(stop).getByText('Kiện dỡ ra').nextElementSibling).toHaveTextContent(String(stopCount(planB, 2)))
  const trip = screen.getByRole('region', { name: 'Phương án B' })
  expect(within(trip).getByText(`${planB.result.metrics.placedCount} / 366 kiện`)).toBeInTheDocument()
  expect(screen.getByText(/không máy chủ, không tài khoản/)).toBeInTheDocument()
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  // Không có bảng chia sẻ lẫn bộ nhớ tạm: không có nút chia sẻ
  expect(screen.queryByRole('button', { name: /liên kết/ })).not.toBeInTheDocument()
  // Một nút chính: "Nhận tư vấn" về form liên hệ của trang giới thiệu (kho mẫu không cho khách tự đăng ký)
  expect(screen.getAllByRole('link', { name: 'Nhận tư vấn' })[0]).toHaveAttribute('href', '/gioi-thieu#lien-he')
})

test('choices go to the URL with unaccented slugs, and "Tính thế nào?" explains the stop figures', async () => {
  const user = userEvent.setup()
  setNavigator('share', undefined)
  setNavigator('clipboard', undefined)
  renderPage('/phuong-an-mau?lang=vi&phuong-an=b&che-do=do&diem=2')

  await user.click(screen.getByRole('button', { name: 'Phương án A — Tối đa thể tích' }))
  expect(search()).toBe('?lang=vi&phuong-an=a&che-do=do&diem=2')
  await user.click(screen.getByRole('button', { name: 'Điểm 4 · Đại lý tạp hoá' }))
  expect(search()).toBe('?lang=vi&phuong-an=a&che-do=do&diem=4')
  expect(screen.getByRole('region', { name: 'Ở điểm 4 · Đại lý tạp hoá' })).toBeInTheDocument()

  const how = screen.getByRole('button', { name: /điểm 4/ })
  expect(how).toHaveAttribute('aria-expanded', 'false')
  await user.click(how)
  expect(how).toHaveAttribute('aria-expanded', 'true')
  expect(screen.getByText(/phải dời ra trước/)).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: 'Xếp hàng' }))
  expect(search()).toBe('?lang=vi&phuong-an=a&che-do=xep&diem=4')
  expect(screen.queryByRole('group', { name: 'Dỡ ở điểm' })).not.toBeInTheDocument()
  expect(screen.queryByRole('region', { name: /^Ở điểm/ })).not.toBeInTheDocument()
})

test('"Sao chép liên kết" copies a link to the exact scene and says so; with a share sheet the button shares instead', async () => {
  const user = userEvent.setup()
  setNavigator('share', undefined)
  const writeText = vi.fn().mockResolvedValue(undefined)
  setNavigator('clipboard', { writeText })
  const view = renderPage('/phuong-an-mau?phuong-an=b&che-do=do&diem=2&goc=tren')

  await user.click(screen.getByRole('button', { name: 'Sao chép liên kết' }))
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/phuong-an-mau?phuong-an=b&che-do=do&diem=2&goc=tren`)
  await waitFor(() => expect(screen.getByText('Đã sao chép liên kết tới đúng cảnh đang xem.')).toHaveAttribute('role', 'status'))
  view.unmount()

  const share = vi.fn().mockRejectedValueOnce(new DOMException('cancel', 'AbortError')).mockResolvedValue(undefined)
  setNavigator('share', share)
  renderPage('/phuong-an-mau?phuong-an=c&che-do=xep')
  const button = screen.getByRole('button', { name: 'Chia sẻ liên kết' })
  // Đóng bảng chia sẻ: không nói gì
  await user.click(button)
  expect(share).toHaveBeenCalledWith({ title: 'Phương án mẫu — LoadMaster', url: `${window.location.origin}/phuong-an-mau?phuong-an=c&che-do=xep` })
  expect(screen.queryByText(/Đã chia sẻ/)).not.toBeInTheDocument()
  await user.click(button)
  expect(await screen.findByText('Đã chia sẻ liên kết tới đúng cảnh đang xem.')).toHaveAttribute('role', 'status')
})
