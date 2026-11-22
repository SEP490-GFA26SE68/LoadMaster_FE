import {QueryClient,QueryClientProvider} from '@tanstack/react-query'
import {render,screen,waitFor,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {createMemoryRouter,RouterProvider} from 'react-router'
import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {I18nProvider} from '@/lib/i18n'
import {connectApiAuth} from '@/lib/api-client'
import {warehouseListResponse,warehousePackages} from '@/test/package-list-fixture'
import {PackagesPage} from './PackagesPage'
import {PackageTypesPage} from './PackageTypesPage'
vi.mock('@/features/auth/useCan',()=>({useCan:()=>()=>false}))
vi.mock('@/lib/backend-config',()=>({backendConfig:{authSource:'keycloak',apiUrl:'http://be.test',features:new Set(['packages']),keycloak:{url:'',realm:'',clientId:''}},usesBackend:(f:string)=>f==='packages'}))
let calls:URL[]
beforeEach(()=>{
 calls=[];connectApiAuth(async()=>'fixture')
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
  const url=new URL(input);calls.push(url);expect(init?.method??'GET').toBe('GET')
  if(url.searchParams.get('search')==='ERR')return Response.json({success:false,code:'FORBIDDEN'},{status:403})
  if(/^\/api\/packages\/\d+$/.test(url.pathname))return Response.json({success:true,data:warehousePackages.find(p=>p.id===Number(url.pathname.split('/').at(-1)))})
  return Response.json(warehouseListResponse(url))
 }))
})
afterEach(()=>{vi.unstubAllGlobals();connectApiAuth(async()=>null)})
function open(path='/kien-hang'){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}})
 const router=createMemoryRouter([{path:'/kien-hang',element:<PackagesPage/>},{path:'/loai-kien',element:<PackageTypesPage/>}],{initialEntries:[path]})
 render(<I18nProvider><QueryClientProvider client={client}><RouterProvider router={router}/></QueryClientProvider></I18nProvider>)
 return {router,client,user:userEvent.setup()}
}
test('global package search finds page-five target, uses exact detail ID, query key contains filters',async()=>{
 const {router,client,user}=open('/kien-hang?trang=6')
 await screen.findByRole('button',{name:'PKG-126'})
 await router.navigate('/kien-hang?q=PKG-126')
 await waitFor(()=>expect(screen.getAllByRole('row')).toHaveLength(2))
 expect(screen.getByRole('button',{name:'PKG-126'})).toBeVisible()
 expect(calls.at(-1)?.searchParams.get('page')).toBe('0')
 const keys=client.getQueryCache().getAll().map(q=>JSON.stringify(q.queryKey))
 expect(keys.some(k=>k.includes('"search":"PKG-126"')&&k.includes('"sortBy":"id"'))).toBe(true)
 await user.click(screen.getByRole('button',{name:'PKG-126'}))
 await waitFor(()=>expect(calls.some(u=>u.pathname==='/api/packages/126')).toBe(true))
 expect(calls.every(u=>!u.pathname.includes('/confirm'))).toBe(true)
})
test('RETURNED plus handling class and search are combined server-side with filtered total',async()=>{
 const {router}=open('/kien-hang?q=PKG-1&trang-thai=hoan-tra&loai-hang=de-vo')
 await screen.findByRole('button',{name:'PKG-102'})
 expect(screen.getAllByRole('row')).toHaveLength(18)
 const q=calls.at(-1)!.searchParams
 expect(Object.fromEntries(q)).toMatchObject({search:'PKG-1',status:'RETURNED',handlingClass:'FRAGILE',page:'0'})
 await router.navigate('/kien-hang?q=PKG-126&trang-thai=hoan-tra')
 await screen.findByRole('button',{name:'PKG-126'})
 await waitFor(()=>expect(screen.getAllByRole('row')).toHaveLength(2))
})
test('type search finds later page, sort headers issue ASC/DESC and reset page',async()=>{
 const {router,user}=open('/loai-kien?q=TYPE-61')
 await screen.findByText('Target type',{exact:true})
 expect(screen.getAllByRole('row')).toHaveLength(2)
 await router.navigate('/loai-kien?trang=2')
 await screen.findByText('Type 026',{exact:true})
 await user.click(screen.getByRole('button',{name:'Loại kiện'}))
 await waitFor(()=>expect(calls.at(-1)!.searchParams.get('sortDir')).toBe('DESC'))
 expect(calls.at(-1)!.searchParams.get('page')).toBe('0')
 await screen.findByText('Type 080',{exact:true})
 await user.click(screen.getByRole('button',{name:'Loại kiện'}))
 await waitFor(()=>expect(calls.at(-1)!.searchParams.get('sortDir')).toBe('ASC'))
})
test('empty search retains controls; HTTP error is not a successful empty state',async()=>{
 const {router}=open('/kien-hang?q=not-present')
 await screen.findByRole('searchbox')
 await waitFor(()=>expect(screen.queryByRole('button',{name:'PKG-001'})).not.toBeInTheDocument())
 expect(screen.getByRole('searchbox')).toHaveValue('not-present')
 await router.navigate('/kien-hang?q=ERR')
 await waitFor(()=>expect(screen.getByRole('status')).not.toHaveTextContent(/^$/))
 await waitFor(()=>expect(screen.queryByRole('table')).not.toBeInTheDocument())
 expect(screen.getByRole('searchbox')).toHaveValue('ERR')
})
test('package numeric sorting is performed by server, preserves its page order',async()=>{
 const {user}=open()
 await screen.findByRole('button',{name:'PKG-001'})
 await user.click(screen.getByRole('button',{name:'Khối lượng'}))
 await waitFor(()=>expect(calls.at(-1)!.searchParams.get('sortBy')).toBe('actualWeightKg'))
 await screen.findByRole('button',{name:'PKG-200'})
 expect(within(screen.getAllByRole('row')[1]!).getByRole('button',{name:'PKG-200'})).toBeVisible()
})

test('a delayed old request cannot replace newer search; history restores server parameters',async()=>{
 let release:()=>void=()=>{}
 let accepted:()=>void=()=>{}
 const started=new Promise<void>(r=>{accepted=r})
 const gate=new Promise<void>(r=>{release=r})
 const normal=globalThis.fetch
 vi.stubGlobal('fetch',vi.fn(async(input:string,init?:RequestInit)=>{
  if(new URL(input).searchParams.get('search')==='PKG-125'){accepted();await gate}
  return normal(input,init)
 }))
 const {router}=open('/kien-hang?q=PKG-125')
 await started
 expect(screen.queryByRole('button',{name:'PKG-125'})).not.toBeInTheDocument()
 await router.navigate('/kien-hang?q=PKG-126')
 await screen.findByRole('button',{name:'PKG-126'})
 release()
 await waitFor(()=>expect(calls.some(u=>u.searchParams.get('search')==='PKG-125')).toBe(true))
 expect(screen.queryByRole('button',{name:'PKG-125'})).not.toBeInTheDocument()
 await router.navigate(-1)
 await screen.findByRole('button',{name:'PKG-125'})
 await router.navigate(1)
 await screen.findByRole('button',{name:'PKG-126'})
})
