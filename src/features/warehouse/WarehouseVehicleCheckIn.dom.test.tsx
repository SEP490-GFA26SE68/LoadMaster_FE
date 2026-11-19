import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { connectApiAuth } from '@/lib/api-client'
import { envelope, stubBackend, type FakeRoutes } from '@/test/fake-backend'
import type { PresenceVehicle } from './vehicle-presence-api'
import { WarehouseVehicleCheckIn } from './WarehouseVehicleCheckIn'
const auth = vi.hoisted(() => ({ user: { id: '7', companyId: '1', role: 'warehouse' } }))
vi.mock('@/features/auth/AuthProvider', () => ({ useAuthSafe: () => auth }))
vi.mock('@/lib/backend-config', () => ({ usesBackend: () => true, backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['warehouse']), keycloak: { url: '', realm: '', clientId: '' } } }))
const path='/api/warehouse/vehicle-presence'
const vehicle: PresenceVehicle={id:6,name:'V6',license_plate:'TEST-6',status:'AVAILABLE',presence_status:'UNKNOWN',current_warehouse_id:null,observed_at:null,actor_name:null}
const vehiclePage = (data: (typeof vehicle)[], page = 0, total = data.length) => ({ ...envelope(data), page, size: 20, totalElements: total, totalPages: Math.ceil(total / 20), last: (page + 1) * 20 >= total })
const routes = (extra:FakeRoutes={}):FakeRoutes => ({
 [`GET ${path}/101/transfers`]:{body:{...envelope([]),totalPages:0,last:true}},
 [`GET ${path}/warehouses`]:{body:envelope([{id:101,name:'A1'}])},
 [`GET ${path}/101/vehicles`]:{body:vehiclePage([vehicle])},
 [`POST ${path}/101/check-in`]:{body:envelope({vehicleId:6,warehouseId:101,status:'AT_WAREHOUSE'})},
 [`GET ${path}/101/vehicles/6/events`]:{body:envelope([{id:1,eventType:'CHECK_IN',actorId:7,warehouseId:101,recordedAt:'2030-01-01T00:00:00Z'}])},...extra,
})
function mount(){const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});return render(<QueryClientProvider client={client}><I18nProvider><WarehouseVehicleCheckIn /></I18nProvider></QueryClientProvider>)}
async function chooseWarehouse(user:ReturnType<typeof userEvent.setup>){await screen.findByRole('option',{name:'A1'});await user.selectOptions(screen.getByRole('combobox',{name:'Kho được phân công'}),'101')}
async function search(user:ReturnType<typeof userEvent.setup>){await chooseWarehouse(user);await user.type(screen.getByRole('textbox',{name:'Biển số hoặc tên xe'}),'TEST-6');await user.click(screen.getByRole('button',{name:'Tìm xe'}));await screen.findByText('TEST-6 · V6')}
beforeEach(()=>{auth.user={id:'7',companyId:'1',role:'warehouse'};connectApiAuth(()=>Promise.resolve('synthetic'))})
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks()})
test('preview and search do not check in; history is an explicit read',async()=>{
 const {calls}=stubBackend(routes());mount();const user=userEvent.setup();await search(user);expect(calls.every(c=>c.method==='GET')).toBe(true);await user.click(screen.getByRole('button',{name:'Lịch sử xác nhận'}));expect(await screen.findByText(/Xe đến kho/)).toBeInTheDocument();expect(calls.every(c=>c.method==='GET')).toBe(true)
})
test('double click sends one action; failed response never marks success; retry freezes UUID and payload',async()=>{
 stubBackend(routes());const fetch=globalThis.fetch;const actions:{key:string|null;body:unknown}[]=[]
 vi.stubGlobal('fetch',(url:string,init:RequestInit={})=>{if(init.method==='POST'){actions.push({key:new Headers(init.headers).get('Idempotency-Key'),body:init.body});if(actions.length===1)return Promise.reject(new TypeError('synthetic offline'))}return fetch(url,init)})
 mount();const user=userEvent.setup();await search(user);await user.dblClick(screen.getByRole('button',{name:'Tôi xác nhận xe đang tại kho'}));expect(actions).toHaveLength(1);expect(screen.queryByText('Máy chủ đã ghi nhận xác nhận.')).not.toBeInTheDocument();await user.click(await screen.findByRole('button',{name:'Thử lại lần xác nhận'}));await screen.findByText('Máy chủ đã ghi nhận xác nhận.');expect(actions).toHaveLength(2);expect(actions[0]).toEqual(actions[1]);expect(actions[0]?.key).toMatch(/^[0-9a-f-]{36}$/)
})
test('unassigned worker cannot choose a warehouse or confirm',async()=>{
 stubBackend(routes({[`GET ${path}/warehouses`]:{body:envelope([])}}));mount();await userEvent.setup().click(screen.getByText('Xác nhận xe có mặt tại kho'));expect(await screen.findByText('Bạn chưa được phân công quản lý kho. Liên hệ quản lý để được phân công.')).toBeInTheDocument();expect(screen.getByRole('button',{name:'Tìm xe'})).toBeDisabled()
})
test('wrong role sees no check-in controls',()=>{auth.user.role='dispatcher';stubBackend(routes());mount();expect(screen.queryByText('Xác nhận xe có mặt tại kho')).not.toBeInTheDocument()})
test('vehicle already at another warehouse cannot be checked in normally',async()=>{
 stubBackend(routes({[`GET ${path}/101/vehicles`]:{body:vehiclePage([{...vehicle,presence_status:'AT_WAREHOUSE',current_warehouse_id:102}])}}));mount();const user=userEvent.setup();await search(user);expect(screen.getByRole('button',{name:'Tôi xác nhận xe đang tại kho'})).toBeDisabled()
})

test('an acknowledged old receipt returning IN_TRANSIT never claims current check-in success',async()=>{
 stubBackend(routes({[`POST ${path}/101/check-in`]:{body:envelope({vehicleId:6,warehouseId:null,status:'IN_TRANSIT'})}}));mount();const user=userEvent.setup();await search(user);await user.click(screen.getByRole('button',{name:'Tôi xác nhận xe đang tại kho'}));expect(await screen.findByText('Trạng thái xe đã thay đổi sau lần xác nhận cũ. Vui lòng kiểm tra trạng thái mới nhất; không coi xe đang có mặt tại kho.')).toBeInTheDocument();expect(screen.queryByText('Máy chủ đã ghi nhận xác nhận.')).not.toBeInTheDocument()
})

test('selecting an assigned warehouse loads company vehicles without a search or mutation', async () => {
 const {calls}=stubBackend(routes());mount();const user=userEvent.setup();await chooseWarehouse(user);await screen.findByText('TEST-6 · V6');expect(screen.getByRole('heading',{name:'Xe thuộc công ty (1)'})).toBeInTheDocument();expect(screen.getByText('Chưa xác định')).toBeInTheDocument();expect(calls.find(c=>c.path.endsWith('/101/vehicles'))?.query).toEqual({query:'',page:'0',size:'20'});expect(calls.every(c=>c.method==='GET')).toBe(true)
})
test('company catalogue pagination reaches later vehicles and keeps search on the server', async () => {
 const first=Array.from({length:20},(_,i)=>({...vehicle,id:i+1,name:`V${i+1}`,license_plate:`TEST-${i+1}`}))
 const {calls}=stubBackend(routes({[`GET ${path}/101/vehicles`]:call=>({body:vehiclePage(call.query.page==='1'?[{...vehicle,id:21,name:'V21',license_plate:'TEST-21'}]:first,Number(call.query.page),21)})}));mount();const user=userEvent.setup();await chooseWarehouse(user);await user.click(await screen.findByRole('button',{name:'Trang sau'}));await screen.findByText('TEST-21 · V21');await user.type(screen.getByRole('textbox',{name:'Biển số hoặc tên xe'}),' TEST ');await user.click(screen.getByRole('button',{name:'Tìm xe'}));await screen.findByText('TEST-1 · V1');const reads=calls.filter(c=>c.path.endsWith('/101/vehicles'));expect(reads.at(-1)?.query).toEqual({query:'TEST',page:'0',size:'20'});expect(calls.every(c=>c.method==='GET')).toBe(true)
})
test('operational availability remains independent from physical presence and displays latest observer', async () => {
 stubBackend(routes({[`GET ${path}/101/vehicles`]:{body:vehiclePage([{...vehicle,actor_name:'Warehouse A',observed_at:'2030-01-01T00:00:00Z'},{...vehicle,id:2,name:'V2',status:'IN_TRIP',presence_status:'IN_TRANSIT'},{...vehicle,id:3,name:'V3',status:'MAINTENANCE',presence_status:'AT_WAREHOUSE',current_warehouse_id:101}])}}));mount();const user=userEvent.setup();await chooseWarehouse(user);await screen.findByText('TEST-6 · V6');expect(screen.getByText('Chưa xác định')).toBeInTheDocument();expect(screen.getByText('AVAILABLE',{exact:true})).toBeInTheDocument();expect(screen.getByText('Đã rời kho')).toBeInTheDocument();expect(screen.getByText(/Đang ở kho/)).toBeInTheDocument();expect(screen.getByText(/Warehouse A/)).toBeInTheDocument();expect(screen.getAllByRole('button',{name:'Tôi xác nhận xe đang tại kho'}).filter(button=>button.hasAttribute('disabled'))).toHaveLength(2)
})


test('loading UNKNOWN offers explicit trip verification, never infers arrival or changes the vehicle', async () => {
 const {calls}=stubBackend(routes({
  [`GET ${path}/101/vehicles`]:{body:vehiclePage([{...vehicle,status:'IN_TRIP',loading_trip_id:90,loading_trip_code:'SYNTHETIC-90'}])},
  [`POST ${path}/101/loading-trips/90/confirm-presence`]:{body:envelope({vehicleId:6,warehouseId:101,status:'AT_WAREHOUSE'})},
 }));mount();const user=userEvent.setup();await chooseWarehouse(user)
 const button=await screen.findByRole('button',{name:'Tôi thấy xe tại kho — xác nhận cho chuyến SYNTHETIC-90'})
 expect(button).toBeEnabled();expect(calls.every(c=>c.method==='GET')).toBe(true)
 await user.click(button);await screen.findByText('Máy chủ đã ghi nhận xác nhận.')
 const posts=calls.filter(c=>c.method==='POST');expect(posts).toHaveLength(1)
 expect(posts[0]?.path).toBe(`${path}/101/loading-trips/90/confirm-presence`);expect(posts[0]?.body).toEqual({vehicleId:6})
 expect(calls.some(c=>c.method==='POST'&&c.path.endsWith('/check-in'))).toBe(false)
})

test('loading verification timeout retry freezes trip and UUID without optimistic arrival',async()=>{
 stubBackend(routes({[`GET ${path}/101/vehicles`]:{body:vehiclePage([{...vehicle,status:'IN_TRIP',loading_trip_id:90}])},[`POST ${path}/101/loading-trips/90/confirm-presence`]:{body:envelope({vehicleId:6,warehouseId:101,status:'AT_WAREHOUSE'})}}))
 const fetch=globalThis.fetch;const posts:{url:string;key:string|null;body:unknown}[]=[]
 vi.stubGlobal('fetch',(url:string,init:RequestInit={})=>{if(init.method==='POST'){posts.push({url,key:new Headers(init.headers).get('Idempotency-Key'),body:init.body});if(posts.length===1)return Promise.reject(new TypeError('synthetic offline'))}return fetch(url,init)})
 mount();const user=userEvent.setup();await chooseWarehouse(user);await user.dblClick(await screen.findByRole('button',{name:'Tôi thấy xe tại kho — xác nhận cho chuyến #90'}))
 expect(posts).toHaveLength(1);expect(screen.queryByText('Máy chủ đã ghi nhận xác nhận.')).not.toBeInTheDocument()
 await user.click(await screen.findByRole('button',{name:'Thử lại lần xác nhận'}));await screen.findByText('Máy chủ đã ghi nhận xác nhận.');expect(posts).toHaveLength(2);expect(posts[0]).toEqual(posts[1])
})
