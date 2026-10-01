import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs, type SeedUserId } from '@/test/signed-in'
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
