import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { toast } from 'sonner'
import { connectApiAuth } from '@/lib/api-client'
import { stubBackend, envelope } from '@/test/fake-backend'
import { renderDriver } from './driver-test-utils'
vi.mock('sonner', () => ({ toast: { error: vi.fn(), warning: vi.fn(), success: vi.fn(), info: vi.fn() } }))
vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(['driver']), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: (feature: string) => feature === 'driver',
}))
beforeEach(() => { connectApiAuth(() => Promise.resolve('fixture-token')); vi.mocked(toast.error).mockClear() })
afterEach(() => vi.unstubAllGlobals())
const rows = [
  { tripId: 10, tripCode: 'FIXTURE-LOADING', status: 'LOADING', loadingCompleted: false },
  { tripId: 11, tripCode: 'FIXTURE-TRANSIT', status: 'IN_TRANSIT' },
  { tripId: 12, tripCode: 'FIXTURE-DELIVERED', status: 'DELIVERED' },
]
test('refresh observes warehouse readiness; transit/delivered remain; rejected start cannot navigate successfully', async () => {
  let ready = false
  const { calls } = stubBackend({
    'GET /api/users/me': { body: envelope({ id: 8 }) },
    'GET /api/driver/trips': () => ({ body: envelope(rows.map(r => r.tripId === 10 ? { ...r, loadingCompleted: ready } : r)) }),
    'GET /api/driver/trips/10/stops': { body: envelope({ stops: [] }) },
    'GET /api/driver/trips/11/stops': { body: envelope({ stops: [] }) },
    'POST /api/driver/trips/10/start': () => {
      ready = false
      return { status: 409, body: { success: false, code: 'LOADING_NOT_COMPLETED' } }
    },
  })
  const p = renderDriver('/tai-xe')
  expect(await screen.findByRole('button', { name: 'Xuất phát' })).toBeDisabled()
  ready = true
  await userEvent.click(screen.getByRole('button', { name: 'Làm mới danh sách' }))
  expect(await screen.findByRole('heading', { level: 2, name: 'Xếp xong — chờ xuất phát' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Xuất phát' })).toBeEnabled()
  for (const code of ['FIXTURE-TRANSIT', 'FIXTURE-DELIVERED']) expect(screen.getByRole('heading', { level: 3, name: code })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Xuất phát' }))
  expect(await screen.findByRole('heading', { level: 2, name: 'Kho đang soạn / xếp' })).toBeInTheDocument()
  expect(toast.error).toHaveBeenCalled()
  expect(screen.getByRole('button', { name: 'Xuất phát' })).toBeDisabled()
  expect(calls.filter(c => c.method === 'POST')).toHaveLength(1)
  p.unmount()
  renderDriver('/tai-xe')
  expect(await screen.findByRole('button', { name: 'Xuất phát' })).toBeDisabled()
  expect(calls.filter(c => c.method === 'POST')).toHaveLength(1)
})
test('empty driver list offers GET refresh without a start action', async () => {
  const { calls } = stubBackend({
    'GET /api/users/me': { body: envelope({ id: 8 }) },
    'GET /api/driver/trips': { body: envelope([]) },
  })
  renderDriver('/tai-xe')
  await userEvent.click(await screen.findByRole('button', { name: 'Làm mới danh sách' }))
  expect(calls.filter(c => c.path === '/api/driver/trips')).toHaveLength(2)
  expect(calls.every(c => c.method === 'GET')).toBe(true)
  expect(screen.queryByRole('button', { name: 'Xuất phát' })).not.toBeInTheDocument()
})


test.each([
 ['DRIVER_VEHICLE_PRESENCE_UNVERIFIED','Chưa xác minh xe tại kho xuất phát. Vui lòng nhờ nhân viên được phân công tại kho xác nhận xe thực tế trước khi xuất phát.'],
 ['DRIVER_VEHICLE_DEPARTURE_BLOCKED','Chưa thể xuất phát do trạng thái xe hoặc kho chưa phù hợp. Vui lòng liên hệ nhân viên kho hoặc điều phối viên để kiểm tra.'],
])('driver presence rejection %s stays LOADING and explains the warehouse action',async(code,message)=>{
 const {calls}=stubBackend({
  'GET /api/users/me':{body:envelope({id:8})},
  'GET /api/driver/trips':{body:envelope([{tripId:10,tripCode:'FIXTURE-LOADING',status:'LOADING',loadingCompleted:true}])},
  'GET /api/driver/trips/10/stops':{body:envelope({stops:[]})},
  'POST /api/driver/trips/10/start':{status:409,body:{success:false,code}},
 })
 renderDriver('/tai-xe');await userEvent.click(await screen.findByRole('button',{name:'Xuất phát'}))
 await waitFor(()=>expect(toast.error).toHaveBeenCalledWith(message))
 expect(message).not.toMatch(/chọn lại xe/i)
 expect(screen.getByRole('heading',{level:2,name:'Xếp xong — chờ xuất phát'})).toBeInTheDocument()
 expect(screen.getByRole('button',{name:'Xuất phát'})).toBeInTheDocument();expect(calls.filter(c=>c.method==='POST')).toHaveLength(1)
})
