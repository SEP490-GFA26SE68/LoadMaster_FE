import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter,createMemoryRouter,RouterProvider} from 'react-router'
import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {AuthProvider} from '@/features/auth/AuthProvider'
import {I18nProvider} from '@/lib/i18n'
import {connectApiAuth} from '@/lib/api-client'
import {signedInAs} from '@/test/signed-in'
import {catalogPage} from '@/test/vehicle-type-catalog-fixture'
import {VehicleTypesPage} from './VehicleTypesPage'
import {VehicleForm} from '@/features/fleet/backend/VehicleForm'
vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn()}}))
vi.mock('@/lib/backend-config',()=>({backendConfig:{authSource:'mock',apiUrl:'http://be.test',features:new Set(['fleet']),keycloak:{url:'',realm:'',clientId:''}},usesBackend:()=>true}))
let count:number,calls:URL[],fail:boolean
beforeEach(()=>{count=100;calls=[];fail=false;signedInAs('dispatcher');connectApiAuth(async()=>'fixture');vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
 const u=new URL(input);calls.push(u);return fail?Response.json({success:false,code:'FORBIDDEN'},{status:403}):Response.json(catalogPage(u,count))
}))})
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()})
function wrap(child:React.ReactNode){return <I18nProvider><AuthProvider><QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}>{child}</QueryClientProvider></AuthProvider></I18nProvider>}
test.each([21,50,100])('all %i catalog entries remain reachable with pagination and correct total',async n=>{
 count=n
 render(wrap(<MemoryRouter initialEntries={[n===100?'/?trang=4':'/']}><VehicleTypesPage/></MemoryRouter>))
 if(n===50){await screen.findByText('Type 001');await userEvent.click(screen.getByRole('button',{name:'Trang sau'}))}
 expect(await screen.findByText('Type '+String(n).padStart(3,'0'))).toBeInTheDocument()
 if(n>25)expect(screen.getByText(n===50?'26–50 / 50':'76–100 / 100',{exact:true})).toBeInTheDocument()
})
test('catalog sort operates across all rows before client pagination, and key fetches only complete data',async()=>{
 render(wrap(<MemoryRouter><VehicleTypesPage/></MemoryRouter>))
 await screen.findByText('Type 001')
 await userEvent.click(screen.getByRole('button',{name:'Tải trọng'}))
 // Numeric column starts DESC in TanStack; global maximum must be reachable on page one.
 expect(await screen.findByText('Type 100')).toBeInTheDocument()
 expect(calls.filter(u=>u.pathname==='/api/vehicle-types')).toHaveLength(1)
})
test('create Vehicle dropdown includes type101, not just first100',async()=>{
 count=101
 const router=createMemoryRouter([{path:'*',element:<VehicleForm/>}])
 render(wrap(<RouterProvider router={router}/>))
 await userEvent.click(await screen.findByRole('combobox',{name:'Loại xe'}))
 expect(await screen.findByRole('option',{name:'Type 101'})).toBeInTheDocument()
 expect(calls.some(u=>u.searchParams.get('page')==='1')).toBe(true)
})
test('empty differs from fetch error; no fake rows after error',async()=>{
 fail=true
 render(wrap(<MemoryRouter><VehicleTypesPage/></MemoryRouter>))
 await waitFor(()=>expect(screen.getByRole('button',{name:'Thử lại'})).toBeInTheDocument())
 expect(screen.queryByText('Type 001')).not.toBeInTheDocument()
})
