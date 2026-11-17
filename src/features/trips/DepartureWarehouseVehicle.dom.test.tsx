import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { connectApiAuth } from '@/lib/api-client'
import { I18nProvider } from '@/lib/i18n'
import { envelope, page, stubBackend, type FakeRoutes } from '@/test/fake-backend'
import { TripFormPage } from './TripFormPage'
import type { TripDetailApiResponse } from './trips-api'

vi.mock('@/features/auth/AuthProvider', () => ({ useAuthSafe: () => ({ user: { id: '7', companyId: '1', role: 'dispatcher' } }) }))

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'keycloak', apiUrl: 'http://be.test', features: new Set(['trips', 'companies']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'trips' || feature === 'companies',
}))

/**
 * Form sửa chuyến khi nhóm `trips` nối backend (`/chuyen/:mã/sua`): mã chuyến trên URL đổi sang mã số, form điền từ Chi tiết chuyến của
 * máy chủ, lưu gửi `PATCH /api/trips/{id}` chỉ với trường đã đổi rồi mở Chi tiết chuyến; chuyến đã sang xếp hàng không có form.
 */
const TRIP: TripDetailApiResponse = {
  originWarehouseId: 101, id: 42, tripCode: 'TRIP-2026-0042', tripName: 'Tân Bình – Quận 7', companyId: 1, vehicleId: 1, vehicleName: 'Hino 500',
  licensePlate: '51C-123.45', driverId: 7, driverName: 'Trần Văn Tài', createdByDispatcherId: 3, departureTime: '2026-11-12 08:30:00',
  originName: 'Kho Tân Bình', originAddress: '12 Cộng Hoà, Tân Bình', originLatitude: 10.8012, originLongitude: 106.6521,
  status: 'PLANNED', createdAt: '2026-11-10T09:00:00',
}
const TYPE = {
  id: 7, name: 'Xe tải 5 tấn thùng kín', innerLength: 620, innerWidth: 235, innerHeight: 240, doorWidth: 230, doorHeight: 230,
  maxPayloadKg: 5000, frontAxleLimitKg: null, rearAxleLimitKg: null, maxCogOffsetRatio: 0.15, hazardousCapable: false, vehicleCount: 1, obstacles: [],
}
const flatPage = (data: readonly unknown[]) => ({ success: true, data, page: 0, size: 100, totalElements: data.length, totalPages: 1, last: true })
const WAREHOUSE = {
  id: 5, companyId: 1, warehouseName: 'Kho Thủ Đức', address: '1 Võ Văn Ngân, Thủ Đức', latitude: 10.85, longitude: 106.77,
  isDefault: false, isActive: true, createdAt: '2026-01-01T00:00:00', updatedAt: '2026-01-01T00:00:00',
}

function routes(trip: TripDetailApiResponse, extra: FakeRoutes = {}): FakeRoutes {
  return {
    'GET /api/trips': { body: envelope(page([{ id: trip.id, tripCode: trip.tripCode }])) },
    'GET /api/trips/42/detail': { body: envelope({ trip, stops: [] }) },
    'GET /api/vehicles': { body: flatPage([{ id: 11, name: 'Hino 500', licensePlate: '51C-123.45', vehicleTypeId: 7, vehicleTypeName: TYPE.name, companyId: 1, companyName: 'Long Bình', status: 'AVAILABLE' }]) },
    'GET /api/vehicle-types': { body: flatPage([TYPE]) },
    'GET /api/trips/driver-options': { body: envelope([{ id: 7, fullName: 'Trần Văn Tài' }]) },
    'GET /api/company-warehouses': { body: envelope([WAREHOUSE]) },
    ...extra,
  }
}

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/chuyen/moi', element: <TripFormPage /> },
      { path: '/chuyen/:tripId/sua', element: <TripFormPage /> },
      { path: '/chuyen/:tripId', element: <p>Chi tiết chuyến của máy chủ</p> },
      { path: '/chuyen', element: <p>Danh sách chuyến</p> },
    ],
    { initialEntries: [path] },
  )
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <I18nProvider>
        <RouterProvider router={router} />
      </I18nProvider>
    </QueryClientProvider>,
  )
  return { user: userEvent.setup(), router }
}

beforeEach(() => {
  connectApiAuth(() => Promise.resolve('token-1'))
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})


// Physical fixture truth is an independent oracle, not a fabricated runtime vehicle.warehouseId.
const PHYSICAL = { A1: [1,2,4], A2: [3], B1: [5] }
const vehicle = (id:number,status='AVAILABLE') => ({id,name:`V${id}`,licensePlate:`AUDIT-${id}`,vehicleTypeId:7,vehicleTypeName:TYPE.name,companyId:id===5?2:1,companyName:id===5?'B':'A',status})
const A1={...WAREHOUSE,id:101,warehouseName:'A1',isDefault:true}
const A2={...WAREHOUSE,id:102,warehouseName:'A2'}
const EMPTY={...WAREHOUSE,id:103,warehouseName:'A-empty'}
function auditRoutes(extra:FakeRoutes={}) {
 return routes(TRIP,{'GET /api/vehicles/departure-choices': ({query}) => ({body:flatPage(query.warehouseId==='102'?[vehicle(3)]:query.warehouseId==='103'?[]:[vehicle(1),vehicle(2)])}), 'GET /api/company-warehouses':{body:envelope([A1,A2,EMPTY])},...extra})
}
async function chooseWarehouse(user:ReturnType<typeof userEvent.setup>,id:string) {
 await screen.findByRole('combobox',{name:'Chọn kho xuất phát'})
 await waitFor(()=>expect((screen.getByRole('combobox',{name:'Chọn kho xuất phát'}) as HTMLSelectElement).querySelector(`option[value="${id}"]`)).not.toBeNull())
 await user.selectOptions(screen.getByRole('combobox',{name:'Chọn kho xuất phát'}),id)
}
async function vehicleOptions(user:ReturnType<typeof userEvent.setup>) {
 await user.click(await screen.findByRole('combobox',{name:'Xe'}))
 await screen.findByRole('listbox')
}
test('T01 choosing A1 excludes physically A2 vehicle V3',async()=>{
 stubBackend(auditRoutes());const {user}=renderAt('/chuyen/moi');await chooseWarehouse(user,'101');await vehicleOptions(user)
 expect(PHYSICAL.A2).toContain(3);expect(screen.queryByRole('option',{name:'V3'})).not.toBeInTheDocument()
})
test('T02 choosing A2 excludes V1 from A1',async()=>{
 stubBackend(auditRoutes());const {user}=renderAt('/chuyen/moi');await chooseWarehouse(user,'102');await vehicleOptions(user)
 expect(screen.queryByRole('option',{name:'V1'})).not.toBeInTheDocument()
})
test('T03 changing departure clears previously selected vehicle and refreshes scope',async()=>{
 const ctx=stubBackend(auditRoutes());const {user}=renderAt('/chuyen/moi');await chooseWarehouse(user,'101');await vehicleOptions(user);await user.click(screen.getByRole('option',{name:'V1'}));await chooseWarehouse(user,'102')
 expect(screen.getByRole('combobox',{name:'Xe'})).not.toHaveTextContent('V1')
 expect(ctx.calls.some(c=>c.path==='/api/vehicles/departure-choices'&&c.query.warehouseId==='102')).toBe(true)
})
test('T05 no departure warehouse disables vehicle selection',async()=>{
 stubBackend(auditRoutes({'GET /api/company-warehouses':{body:envelope([])}}));renderAt('/chuyen/moi');expect(await screen.findByRole('combobox',{name:'Xe'})).toBeDisabled()
})
test('T06 backend eligible response excludes maintenance and UNKNOWN vehicles',async()=>{
 stubBackend(auditRoutes());const {user}=renderAt('/chuyen/moi');await chooseWarehouse(user,'101');await vehicleOptions(user);expect(screen.queryByRole('option',{name:/V4|V6/})).not.toBeInTheDocument()
})

test('T10 edit changing warehouse clears current V1',async()=>{
 stubBackend(auditRoutes());const {user}=renderAt('/chuyen/TRIP-2026-0042/sua');await screen.findByRole('textbox',{name:'Tên chuyến'});await chooseWarehouse(user,'102');expect(screen.getByRole('combobox',{name:'Xe'})).not.toHaveTextContent('V1')
})
test('T18 all eligible pages and no foreign warehouse vehicles',async()=>{
 const ctx=stubBackend(auditRoutes({'GET /api/vehicles/departure-choices':({query})=>({body:{success:true,data:query.page==='1'?[vehicle(2)]:[vehicle(1)],page:Number(query.page),size:100,totalElements:2,totalPages:2,last:query.page==='1'}})}));const {user}=renderAt('/chuyen/moi');await chooseWarehouse(user,'101');await vehicleOptions(user);expect(screen.getByRole('option',{name:'V2'})).toBeInTheDocument();expect(screen.queryByRole('option',{name:'V3'})).not.toBeInTheDocument();expect(ctx.calls.filter(c=>c.path==='/api/vehicles/departure-choices').map(c=>c.query.page)).toEqual(['0','1'])
})
test('T18 empty physical warehouse has an explicit empty state',async()=>{
 stubBackend(auditRoutes());const {user}=renderAt('/chuyen/moi');await chooseWarehouse(user,'103');expect(await screen.findByText('Không có xe đủ điều kiện đã được xác nhận tại kho này.')).toBeInTheDocument()
})
test('T18 API error disables selection and retry uses same warehouse',async()=>{
 let attempts=0;stubBackend(auditRoutes({'GET /api/vehicles/departure-choices':({query})=>query.warehouseId!=='102'? {body:flatPage([vehicle(1)])}: ++attempts===1 ? {status:503,body:{success:false,code:'SERVER_ERROR'}} : {body:flatPage([vehicle(1)])}}));const {user}=renderAt('/chuyen/moi');await chooseWarehouse(user,'102');await waitFor(()=>expect(screen.getByRole('combobox',{name:'Xe'})).toBeDisabled());await user.click(await screen.findByRole('button',{name:'Thử lại'}));await waitFor(()=>expect(screen.getByRole('combobox',{name:'Xe'})).not.toBeDisabled());expect(attempts).toBe(2)
})
