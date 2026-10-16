import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { driver } from '@/lib/i18n/vi/driver'
import { getMockDb } from '@/lib/mock-db'
import { twoCartonRequest, twoCartonResult, twoCartonTrip } from '@/test/mock-db-samples'
import { signedInAs, type SeedUserId } from '@/test/signed-in'
import { loadingOrder, stageAll } from '@/test/trip-flow'
import { DriverStopPage } from './DriverStopPage'
import { MyTripsPage } from './MyTripsPage'

/** Nơi app dẫn tới ngoài màn tài xế: chỉ ghi đường dẫn để test đọc. */
function Elsewhere() {
  const location = useLocation()
  return <output aria-label="route">{location.pathname}</output>
}

/**
 * Màn tài xế qua kho dùng chung (`@/lib/mock-db`) → `driver-api.ts` → hook → màn, không giả lập module dữ liệu nào (LM-087).
 * Hai route thật như `App.tsx`; mỗi lần gọi là một QueryClient mới, như mở lại màn. Mặc định đăng nhập tài xế demo (US-0004); chuyến
 * của tài xế khác thì truyền mã của đúng người đó — chỉ tài xế mở được màn này (FE-0-01).
 */
export function renderDriver(route: string, driver: 'driver' | SeedUserId = 'driver') {
  signedInAs(driver)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/tai-xe" element={<MyTripsPage />} />
              <Route path="/tai-xe/diem-giao" element={<DriverStopPage />} />
              <Route path="*" element={<Elsewhere />} />
            </Routes>
          </MemoryRouter>
        </AuthProvider>
      </I18nProvider>
    </QueryClientProvider>,
  )
}

/** Kho mock có độ trễ giả 300 ms mỗi lượt; một thao tác ghi = ghi + đọc lại. */
export const LOAD = { timeout: 4000 }

/**
 * Chuyến hai thùng của tài xế demo, đã duyệt; kho đã soạn và xếp xong, mọi kiện đều quét (`VF-001`…`VF-004` khi không kiện nào hỏng).
 * `damaged` là các kiện hỏng lúc xếp, bị bỏ lại kho — hai thùng nằm cạnh nhau trên sàn nên không kiện nào tựa lên kiện nào. Điểm giao
 * không có toạ độ, không có hạn: chuyến không có tuyến đã tối ưu.
 */
export async function loadedTwoCartonTrip(damaged: string[] = []) {
  const db = getMockDb()
  const trip = await db.createTrip({ ...twoCartonTrip(), driverId: 'US-0004' })
  const revision = await db.addRevision({ tripId: trip.id, request: twoCartonRequest(), result: twoCartonResult() })
  await db.approveRevision(revision.id, [])
  await db.startLoading(trip.id)
  await stageAll(db, trip.id)
  const tokens = new Map((await db.listTripLabels(trip.id)).map((label) => [label.packageInstanceId, label.qrToken]))
  for (const id of await loadingOrder(db, trip.id)) {
    if (damaged.includes(id)) await db.reportDamagedPackage(trip.id, id)
    else await db.confirmLoadingByQr(trip.id, tokens.get(id) ?? '')
  }
  await db.completeLoading(trip.id)
  return trip.id
}

/** Đầu tiêu đề hộp hỏi lại, trước số điểm. File này không phải file test nên chữ lấy từ từ điển `vi` (cổng LM-070). */
const [CONFIRM_TITLE_START = ''] = driver.completeConfirm.title.split('{number}')

/**
 * Bấm nút hoàn tất ở chân màn (`button`, mặc định nút của điểm giao) rồi nút xác nhận trong hộp hỏi lại; trả hộp để test đọc nội
 * dung trước khi bấm nếu cần (`inspect`). Chưa chờ màn sang điểm kế tiếp.
 */
export async function completeStop(button: string = driver.complete, inspect?: (dialog: HTMLElement) => void) {
  await userEvent.click(await screen.findByRole('button', { name: button }, { timeout: 5000 }))
  const dialog = await screen.findByRole('dialog', { name: (name) => name.startsWith(CONFIRM_TITLE_START) })
  inspect?.(dialog)
  await userEvent.click(within(dialog).getByRole('button', { name: driver.completeConfirm.confirm }))
}
