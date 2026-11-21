import {createRoot} from 'react-dom/client'
import {BrowserRouter,Routes,Route} from 'react-router'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {I18nProvider} from '@/lib/i18n'
import {AuthProvider} from '@/features/auth/AuthProvider'
import {signedInAs} from '@/test/signed-in'
import {PackagesPage} from '@/features/package-pool/backend/PackagesPage'
import {PackageTypesPage} from '@/features/package-pool/backend/PackageTypesPage'
import '@/index.css'
signedInAs('warehouse')
createRoot(document.getElementById('root')!).render(<I18nProvider><AuthProvider><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><BrowserRouter><Routes><Route path="/kien-hang" element={<PackagesPage/>}/><Route path="/loai-kien" element={<PackageTypesPage/>}/></Routes></BrowserRouter></QueryClientProvider></AuthProvider></I18nProvider>)
