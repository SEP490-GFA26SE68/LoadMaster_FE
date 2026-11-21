import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useParams } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/features/auth/AuthProvider'
import { RequireAuth } from '@/features/auth/RequireAuth'
import { RequirePermission } from '@/features/auth/RequirePermission'
import type { KeycloakSession } from '@/features/auth/keycloak-session'
import { BackendInitialActionPanel } from '@/features/optimization/BackendInitialActionPanel'
import { I18nProvider } from '@/lib/i18n'
import '@/index.css'

// Browser integration fixture, never an application entry point. Authentication and permission
// guards are real; only the external session transport is synthetic, as in AuthProvider unit tests.
const session: KeycloakSession = {
  start: async () => true,
  login: async () => {},
  logout: async () => {},
  token: async () => 'OFFLINE_E2E',
  refreshToken: async () => 'OFFLINE_E2E',
  reject: async () => {},
  onEnded: () => () => {},
}
function InitialOptimization() {
  const { tripId = '' } = useParams()
  return <BackendInitialActionPanel tripId={tripId} />
}
createRoot(document.getElementById('root')!).render(
  <I18nProvider>
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <AuthProvider source="keycloak" keycloak={session}>
        <BrowserRouter>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route element={<RequirePermission permission="optimization.run" />}>
                <Route path="/chuyen/:tripId/toi-uu" element={<InitialOptimization />} />
              </Route>
            </Route>
            <Route path="/dang-nhap" element={<p role="alert">Authentication required</p>} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </I18nProvider>,
)
