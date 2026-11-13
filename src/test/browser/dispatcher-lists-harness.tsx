import {createRoot} from 'react-dom/client'
import {BrowserRouter,Routes,Route} from 'react-router'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {I18nProvider} from '@/lib/i18n'
import {AuthProvider} from '@/features/auth/AuthProvider'
import {signedInAs} from '@/test/signed-in'
import {RequirementsPage} from '@/features/requirements/backend/RequirementsPage'
import {BackendTripListPage} from '@/features/trips/BackendTripListPage'
import '@/index.css'
signedInAs('dispatcher')
createRoot(document.getElementById('root')!).render(<I18nProvider><AuthProvider><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BrowserRouter><Routes><Route path="/yeu-cau-giao" element={<RequirementsPage/>}/><Route path="/chuyen" element={<BackendTripListPage/>}/></Routes></BrowserRouter></QueryClientProvider></AuthProvider></I18nProvider>)
