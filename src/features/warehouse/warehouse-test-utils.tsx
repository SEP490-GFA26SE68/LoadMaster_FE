import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { I18nProvider } from '@/lib/i18n'
import { signedInAs } from '@/test/signed-in'
import { WarehousePage } from './WarehousePage'

/**
 * Ô 3D lazy-load thật trong jsdom: `usePerformanceFlags` đọc `prefers-reduced-motion` qua `matchMedia`, jsdom chưa có.
 * Canvas không có kích thước nên không dựng WebGL; test chỉ đọc phần DOM của màn.
 */
window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

/** Nơi app dẫn tới ngoài màn kho (chi tiết chuyến của điều phối viên): chỉ ghi đường dẫn để test đọc. */
function Elsewhere() {
  const location = useLocation()
  return <output aria-label="route">{location.pathname}</output>
}

/**
 * Màn kho qua kho dùng chung (`@/lib/mock-db`) → `warehouse-api.ts` → hook → màn, không giả lập module dữ liệu nào (LM-086).
 * Mỗi lần gọi là một QueryClient mới, như mở lại màn: dữ liệu đọc lại từ kho. Người xem là nhân viên kho demo (US-0003) — chỉ nhân
 * viên kho mở được màn này (FE-0-01).
 */
export function renderWarehouse(route: string) {
  signedInAs('warehouse')
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <I18nProvider>
        <AuthProvider>
          <MemoryRouter initialEntries={[route]}>
            <Routes>
              <Route path="/kho" element={<WarehousePage />} />
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
