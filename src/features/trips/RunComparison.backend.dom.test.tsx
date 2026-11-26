import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, page, stubBackend } from '@/test/fake-backend'
import { PlanComparisonPage } from './PlanComparisonPage'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips',
}))

/**
 * So sánh theo lần chạy bản máy chủ: ảnh cách xếp từ chỗ xếp thật (không có xe thì không có ảnh, không khung rỗng), hồ sơ của từng phương
 * án, biểu đồ điểm cộng / trừ kèm dấu và số, khoản trừ lớn nhất, thanh tải trục so giới hạn, phương án trùng thu gọn, thẻ lần chạy có thời
 * gian tính và số kiện xếp được. Không nút chính, không MOCK RESULT.
 */
const box = (id: number, x: string, stop: number) => ({
  id, packageId: 100 + id, packageCode: `PK-${id}`, posX: x, posY: '0', posZ: '0', packedLength: '100', packedWidth: '100', packedHeight: '100',
  stopSequence: stop, weightKg: '20',
})

const plan = (id: number, label: string, extra: object = {}) => ({
  id, tripId: 42, jobUuid: 'job-1', vehicleId: 7, objective: null, candidateLabel: label, algorithmName: 'EP_DBLF', computationMs: null,
  volumeUtilization: '0.6', weightUtilization: null, approved: false, approvedByName: null, rehandlingCount: null,
  placements: [box(1, '0', 1), box(2, '100', 2)], unplaced: [], ...extra,
})

const SCORE = (profile: string) => ({
  profile, assumedWeights: false, j: '66.0', uVol: '0.625', uN: '0.9', wVol: '0.6', wN: '0.4',
  components: [
    { code: 'S1', value: '0.25', weight: '0.3', contribution: '-7.5', computed: true },
    { code: 'S2', value: '0.1', weight: '0.2', contribution: '-2', computed: true },
    { code: 'S3', value: null, weight: '0.1', contribution: null, computed: false },
  ],
})

const VEHICLE = {
  vehicleId: 7, vehicleName: 'Xe tải 1,5 tấn', licensePlate: '51C-123.45', innerLength: 400, innerWidth: 200, innerHeight: 200, maxPayloadKg: '1500',
  frontAxleX: '-100', rearAxleX: '300', emptyFrontAxleLoadKg: '1200', emptyRearAxleLoadKg: '900', frontAxleLimitKg: '2500', rearAxleLimitKg: '4000',
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

function renderComparison() {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <MemoryRouter initialEntries={['/chuyen/TRIP-42/so-sanh?lan-chay=job-1']}>
          <Routes><Route path="/chuyen/:tripId/so-sanh" element={<PlanComparisonPage />} /></Routes>
        </MemoryRouter>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

const cardOf = (label: string) => document.querySelector<HTMLElement>(`[data-plan-card="${label}"]`)!

test('ảnh từ chỗ xếp thật, hồ sơ, biểu đồ điểm, tải trục, phương án trùng thu gọn, thẻ lần chạy', async () => {
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1': { body: envelope({ jobId: 'job-1', status: 'COMPLETED', computationMs: 60_000, runAlgorithm: 'EP_DBLF_GA' }) },
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([
      plan(1, 'A', { planScore: SCORE('A'), computationMs: 850, frontAxleLoad: '1250', rearAxleLoad: '4400' }),
      plan(2, 'B', { planScore: SCORE('B'), duplicateOf: 'A' }),
      plan(3, 'C', { vehicleId: 9, planScore: SCORE('C'), frontAxleLoad: '1300', placements: [box(1, '0', 1)], unplaced: [{ packageId: 102, packageCode: 'PK-2' }] }),
    ]) },
    'GET /api/vehicles/7/config': { body: envelope(VEHICLE) },
    'GET /api/vehicles/9/config': { status: 500, body: { success: false, message: 'boom' } },
  })
  renderComparison()

  // Ảnh của A dựng từ hai chỗ xếp thật
  const image = await screen.findByRole('img', { name: 'Cách xếp của phương án A: 2 / 2 kiện trong thùng, nhìn từ phía cửa sau' })
  expect(cardOf('1')).toContainElement(image)
  // C: xe đọc lỗi thì không có ảnh, không thanh tải trục — số tải trục máy chủ trả vẫn có
  expect(within(cardOf('3')).queryByRole('img')).not.toBeInTheDocument()
  expect(cardOf('3').querySelector('[data-axle-usage]')).toBeNull()
  expect(within(cardOf('3')).getByText('Tải trục trước')).toBeInTheDocument()

  // Hồ sơ: icon + một câu
  expect(within(cardOf('1')).getByText('Ưu tiên chở được nhiều hàng nhất trong một chuyến.')).toBeInTheDocument()
  expect(within(cardOf('2')).getByText('Ưu tiên tải đặt an toàn: trọng tâm thấp và giữa thùng, hai trục cân bằng.')).toBeInTheDocument()
  expect(within(cardOf('3')).getByText('Ưu tiên dỡ nhanh ở từng điểm giao: ít kiện phải dỡ ra rồi xếp lại.')).toBeInTheDocument()

  // Biểu đồ điểm: dấu và số, hình aria-hidden, khoản trừ lớn nhất đọc được
  const bars = cardOf('1').querySelector<HTMLElement>('[data-score-bars]')!
  expect(bars.querySelector('ul')).toHaveAttribute('aria-hidden', 'true')
  const bar = (key: string) => bars.querySelector<HTMLElement>(`[data-score-bar="${key}"]`)!
  expect(bar('volume')).toHaveAttribute('data-sign', 'plus')
  expect(bar('volume')).toHaveTextContent('+37,5')
  expect(bar('count')).toHaveTextContent('+36,0')
  expect(bar('S1')).toHaveTextContent('−7,5')
  expect(bar('S2')).toHaveTextContent('−2,0')
  expect(bars.querySelector('[data-score-bar="S3"]')).toBeNull()
  expect(within(bars).getByText('Khoản trừ lớn nhất: Dỡ-xếp lại, 7,5 điểm.')).toBeInTheDocument()
  // Thanh mọc một lần chỉ khi không giảm chuyển động
  expect(bar('volume').querySelector('span > span')?.className).toMatch(/motion-safe:animate-\[lm-bar-grow/)
  // "Tính thế nào?" vẫn có
  expect(within(cardOf('1')).getByRole('button', { name: 'Tính thế nào? — Điểm phương án A' })).toBeInTheDocument()

  // Tải trục so giới hạn: vượt thì có chữ
  const axle = cardOf('1').querySelector<HTMLElement>('[data-axle-usage]')!
  expect(axle.querySelector('[data-axle-group="front"] [data-axle-over]')).toBeNull()
  expect(axle.querySelector('[data-axle-group="rear"] [data-axle-over]')).toHaveTextContent(/^Vượt 400/)

  // Phương án trùng: giữ hồ sơ, điểm, "Tính thế nào?", nút Planner; bỏ ảnh và chỉ số
  const duplicate = cardOf('2')
  expect(duplicate).toHaveAttribute('data-duplicate', 'true')
  expect(within(duplicate).queryByRole('img')).not.toBeInTheDocument()
  expect(within(duplicate).queryByText('Thể tích')).not.toBeInTheDocument()
  expect(within(duplicate).getByText(/^Cùng cách xếp với phương án A/)).toBeInTheDocument()
  expect(duplicate.querySelector('[data-score-bars]')).not.toBeNull()
  expect(within(duplicate).getByRole('button', { name: 'Tính thế nào? — Điểm phương án B' })).toBeInTheDocument()
  expect(within(duplicate).getByRole('link', { name: 'Mở trong Planner' })).toHaveAttribute('href', '/chuyen/TRIP-42/phuong-an?revision=2')

  // Thời gian tính dễ đọc
  expect(within(cardOf('1')).getByText('850 ms')).toBeInTheDocument()
  const runCard = document.querySelector<HTMLElement>('[data-run-card]')!
  expect(await within(runCard).findByText('60,0 giây')).toBeInTheDocument()
  expect(within(runCard).getByText('1–2 / 2')).toBeInTheDocument()

  expect(screen.getAllByRole('link', { name: 'Mở trong Planner' })).toHaveLength(3)
  expect(screen.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  expect(document.querySelector('[data-score-note]')).not.toBeNull()
})

test('máy chủ cũ: không xe, không điểm, không job — không ảnh, không biểu đồ, không khung rỗng', async () => {
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([
      plan(1, 'A', { vehicleId: null, placements: [box(1, '0', 1)] }),
      plan(2, 'B', { vehicleId: null, placements: [{ ...box(1, '0', 1), stopSequence: null }] }),
    ]) },
  })
  renderComparison()
  await screen.findAllByRole('heading', { level: 2 })
  expect(screen.queryByRole('img')).not.toBeInTheDocument()
  expect(document.querySelector('[data-score-bars]')).toBeNull()
  expect(document.querySelector('[data-axle-usage]')).toBeNull()
  expect(document.querySelector('[data-plan-profile="A"]')).not.toBeNull()
  // Thẻ lần chạy vẫn có số kiện xếp được của chính các phương án
  expect(within(document.querySelector<HTMLElement>('[data-run-card]')!).getByText('1 / 1')).toBeInTheDocument()
})

test('xe của chuyến khi phương án không ghi xe: ảnh vẫn có', async () => {
  stubBackend({
    'GET /api/trips/optimization-jobs/job-1/plans': { body: envelope([plan(1, 'A', { vehicleId: null })]) },
    'GET /api/trips': { body: envelope(page([{ id: 42, tripCode: 'TRIP-42' }])) },
    'GET /api/trips/42/vehicle-config': { body: envelope(VEHICLE) },
  })
  renderComparison()
  expect(await screen.findByRole('img', { name: /^Cách xếp của phương án A/ })).toBeInTheDocument()
})
