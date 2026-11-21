import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {render,screen,waitFor} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {MemoryRouter} from 'react-router'
import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {AuthProvider} from '@/features/auth/AuthProvider'
import {I18nProvider} from '@/lib/i18n'
import {connectApiAuth} from '@/lib/api-client'
import {signedInAs} from '@/test/signed-in'
import {dispatcherListResponse} from '@/test/dispatcher-list-fixture'
import {RequirementsPage} from './RequirementsPage'
import {BackendTripListPage} from '@/features/trips/BackendTripListPage'
vi.mock('sonner',()=>({toast:{success:vi.fn(),error:vi.fn()}}))
vi.mock('@/lib/backend-config',()=>({backendConfig:{authSource:'mock',apiUrl:'http://be.test',features:new Set(['trips','fleet']),keycloak:{url:'',realm:'',clientId:''}},usesBackend:()=>true}))
let calls:URL[]
beforeEach(()=>{calls=[];connectApiAuth(async()=>'fixture');signedInAs('dispatcher');vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
 const u=new URL(input);calls.push(u)
 return u.searchParams.get('search')==='ERR'?Response.json({success:false,code:'FORBIDDEN'},{status:403}):Response.json(dispatcherListResponse(u))
}))})
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()})
function mount(path='/',trip=false){
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}})
 render(<I18nProvider><AuthProvider><QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>{trip?<BackendTripListPage/>:<RequirementsPage/>}</MemoryRouter></QueryClientProvider></AuthProvider></I18nProvider>)
 return client
}
test('tripCode search finds rows outside first page without nested trip; resets page',async()=>{
 mount('/?trang=3')
 await screen.findByRole('button',{name:'Xem chi tiết yêu cầu 51'})
 await userEvent.type(screen.getByRole('searchbox'),'TRIP-TARGET')
 expect(await screen.findByRole('button',{name:'Xem chi tiết yêu cầu 109'})).toBeInTheDocument()
 await waitFor(()=>expect(calls.at(-1)?.searchParams.get('page')).toBe('0'))
 expect(screen.getByText('1–2 / 2',{exact:true})).toBeInTheDocument()
 expect(screen.queryByRole('button',{name:'Xem chi tiết yêu cầu 51'})).not.toBeInTheDocument()
 const add=screen.getByRole('button',{name:'Tạo yêu cầu giao'})
 expect(add.closest('header')).not.toBeNull()
 expect(document.querySelector('.sky-overlap')).toBeNull()
})
test('combined URL filters, sort and every query param participate in query key',async()=>{
 const client=mount('/?q=Target&trang-thai=giao-thieu&uu-tien=cao&han-tu=2026-11-12&han-den=2026-11-12')
 await screen.findByRole('button',{name:'Xem chi tiết yêu cầu 109'})
 const u=calls.at(-1)!
 expect(u.searchParams.get('status')).toBe('PARTIAL')
 expect(u.searchParams.get('priority')).toBe('HIGH')
 expect(u.searchParams.get('deadlineTo')).toBe('2026-11-13T00:00:00')
 await userEvent.click(screen.getByRole('button',{name:'Yêu cầu'}))
 await waitFor(()=>expect(calls.at(-1)?.searchParams.get('sortBy')).toBe('id'))
 expect(client.getQueryCache().getAll().some(q=>JSON.stringify(q.queryKey).includes('PARTIAL'))).toBe(true)
})
test('empty and failure retain filter controls and hide previous rows',async()=>{
 mount()
 await screen.findByRole('button',{name:'Xem chi tiết yêu cầu 1'})
 const input=screen.getByRole('searchbox')
 await userEvent.type(input,'missing')
 await screen.findByText('Chưa có yêu cầu giao nào.')
 expect(screen.queryByRole('table')).not.toBeInTheDocument()
 await userEvent.clear(input);await userEvent.type(input,'ERR')
 await waitFor(()=>expect(screen.queryByRole('table')).not.toBeInTheDocument())
 expect(screen.getByRole('searchbox')).toBeInTheDocument()
})
test('vehicle and driver options independent of current Trip page, URL selection remains on empty search',async()=>{
 mount('/?xe=130&tai-xe=390&q=absent',true)
 await waitFor(()=>expect(calls.some(u=>u.pathname==='/api/vehicles'&&u.searchParams.get('page')==='1')).toBe(true))
 expect(await screen.findByRole('combobox',{name:'Xe'})).toBeInTheDocument()
 expect(await screen.findByRole('combobox',{name:'Tài xế'})).toBeInTheDocument()
 expect(calls.some(u=>u.pathname==='/api/trips/driver-options')).toBe(true)
 const trip=calls.find(u=>u.pathname==='/api/trips')!
 expect(trip.searchParams.get('vehicleId')).toBe('130');expect(trip.searchParams.get('driverId')).toBe('390')
})