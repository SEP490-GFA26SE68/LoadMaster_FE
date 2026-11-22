import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {render,screen,waitFor,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {createMemoryRouter,RouterProvider} from 'react-router'
import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {I18nProvider} from '@/lib/i18n'
import {connectApiAuth} from '@/lib/api-client'
import {fleetListResponse} from '@/test/fleet-list-fixture'
import {FleetPage} from './FleetPage'
vi.mock('@/features/auth/useCan',()=>({useCan:()=>()=>false}))
vi.mock('@/lib/backend-config',()=>({backendConfig:{authSource:'keycloak',apiUrl:'http://be.test',features:new Set(['fleet']),keycloak:{url:'',realm:'',clientId:''}},usesBackend:(f:string)=>f==='fleet'}))
let calls:URL[]
beforeEach(()=>{
 calls=[];connectApiAuth(async()=>'fixture')
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
  const u=new URL(input);calls.push(u);expect(init?.method??'GET').toBe('GET')
  if(u.searchParams.get('search')==='ERR')return Response.json({success:false,code:'FORBIDDEN'},{status:403})
  return Response.json(fleetListResponse(u))
 }))
})
afterEach(()=>{vi.unstubAllGlobals();connectApiAuth(async()=>null)})
function open(path='/doi-xe'){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})
 const router=createMemoryRouter([{path:'/doi-xe',element:<FleetPage/>}],{initialEntries:[path]})
 render(<I18nProvider><QueryClientProvider client={client}><RouterProvider router={router}/></QueryClientProvider></I18nProvider>)
 return {router,client,user:userEvent.setup()}
}
test('status control finds maintenance outside first page, resets page and keys every parameter',async()=>{
 const {user,client}=open('/doi-xe?trang=4')
 await screen.findByRole('link',{name:'Vehicle 076'})
 await user.click(screen.getByRole('combobox',{name:'Trạng thái'}))
 await user.click(screen.getByRole('option',{name:'Bảo dưỡng'}))
 await waitFor(()=>expect(screen.getAllByRole('row')).toHaveLength(3))
 expect(calls.at(-1)!.searchParams.get('status')).toBe('MAINTENANCE')
 expect(calls.at(-1)!.searchParams.get('page')).toBe('0')
 expect(client.getQueryCache().getAll().some(q=>JSON.stringify(q.queryKey).includes('"status":"MAINTENANCE"')&&JSON.stringify(q.queryKey).includes('"sortBy":"name"'))).toBe(true)
 expect(screen.getByText('1–2 / 2')).toBeVisible()
})
test('search, status and type combine in one server query with correct total',async()=>{
 open('/doi-xe?q=PLATE-07&trang-thai=bao-duong&loai-xe=2')
 await screen.findByRole('link',{name:'Vehicle 076'})
 expect(screen.getAllByRole('row')).toHaveLength(2)
 expect(Object.fromEntries(calls.at(-1)!.searchParams)).toMatchObject({search:'PLATE-07',status:'MAINTENANCE',vehicleTypeId:'2'})
 expect(screen.queryByRole('link',{name:'Vehicle 077'})).not.toBeInTheDocument()
})
test('sort sends DESC/ASC and preserves server page order, not current-page sorting',async()=>{
 const {user}=open()
 await screen.findAllByRole('link',{name:'Same name'})
 await user.click(screen.getByRole('button',{name:'Phương tiện'}))
 await screen.findByRole('link',{name:'Vehicle 100'})
 expect(within(screen.getAllByRole('row')[1]!).getByRole('link',{name:'Vehicle 100'})).toBeVisible()
 expect(calls.at(-1)!.searchParams.get('sortDir')).toBe('DESC')
 await user.click(screen.getByRole('button',{name:'Trang sau'}))
 await screen.findByRole('link',{name:'Vehicle 074'})
 expect(screen.getByText('26–50 / 100')).toBeVisible()
 await user.click(screen.getByRole('button',{name:'Phương tiện'}))
 await waitFor(()=>expect(calls.at(-1)!.searchParams.get('page')).toBe('0'))
 expect(calls.at(-1)!.searchParams.get('sortDir')).toBe('ASC')
})
test('empty and HTTP error retain search controls and are not equivalent',async()=>{
 const {router}=open('/doi-xe?q=not-present')
 await screen.findByRole('table')
 expect(screen.getByRole('searchbox')).toHaveValue('not-present')
 await router.navigate('/doi-xe?q=ERR')
 await screen.findByText('Không tải được đội xe')
 expect(screen.queryByRole('table')).not.toBeInTheDocument()
 expect(screen.getByRole('searchbox')).toHaveValue('ERR')
})
test('late old response cannot replace a newer search; history restores params',async()=>{
 let release:()=>void=()=>{},started:()=>void=()=>{}
 const ready=new Promise<void>(r=>{started=r}),gate=new Promise<void>(r=>{release=r}),normal=globalThis.fetch
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
  if(new URL(input).searchParams.get('search')==='PLATE-089'){started();await gate}
  return normal(input,init)
 }))
 const {router}=open('/doi-xe?q=PLATE-089')
 await ready
 expect(screen.queryByRole('link',{name:'Vehicle 089'})).not.toBeInTheDocument()
 await router.navigate('/doi-xe?q=PLATE-090')
 await screen.findByRole('link',{name:'Target truck'})
 release()
 await waitFor(()=>expect(calls.some(u=>u.searchParams.get('search')==='PLATE-089')).toBe(true))
 expect(screen.queryByRole('link',{name:'Vehicle 089'})).not.toBeInTheDocument()
 await router.navigate(-1);await screen.findByRole('link',{name:'Vehicle 089'})
 await router.navigate(1);await screen.findByRole('link',{name:'Target truck'})
})
