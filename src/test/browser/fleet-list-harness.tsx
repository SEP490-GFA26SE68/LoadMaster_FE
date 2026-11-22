import {createRoot} from 'react-dom/client'
import {BrowserRouter,Routes,Route} from 'react-router'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {I18nProvider} from '@/lib/i18n'
import {AuthProvider} from '@/features/auth/AuthProvider'
import {signedInAs} from '@/test/signed-in'
import {FleetPage} from '@/features/fleet/backend/FleetPage'
import '@/index.css'
signedInAs('dispatcher')
createRoot(document.getElementById('root')!).render(<I18nProvider><AuthProvider><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BrowserRouter><Routes><Route path="/doi-xe" element={<FleetPage/>}/></Routes></BrowserRouter></QueryClientProvider></AuthProvider></I18nProvider>)
