import {createRoot} from 'react-dom/client'
import {createBrowserRouter,RouterProvider} from 'react-router'
import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {I18nProvider} from '@/lib/i18n'
import {AuthProvider} from '@/features/auth/AuthProvider'
import {signedInAs} from '@/test/signed-in'
import {VehicleTypesPage} from '@/features/vehicle-types/backend/VehicleTypesPage'
import {VehicleForm} from '@/features/fleet/backend/VehicleForm'
import '@/index.css'
signedInAs('dispatcher')
const router=createBrowserRouter([{path:'/loai-xe',element:<VehicleTypesPage/>},{path:'/doi-xe/them',element:<VehicleForm/>}])
createRoot(document.getElementById('root')!).render(<I18nProvider><AuthProvider><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><RouterProvider router={router}/></QueryClientProvider></AuthProvider></I18nProvider>)
