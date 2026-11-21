import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, test, vi } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { connectApiAuth } from '@/lib/api-client'
import { stubBackend } from '@/test/fake-backend'
import { WarehouseCustomersPage } from './WarehouseCustomersPage'
vi.mock('@/lib/backend-config', () => ({
  backendConfig:{authSource:'mock',apiUrl:'http://be.test',features:new Set(['trips']),keycloak:{url:'',realm:'',clientId:''}},
  usesBackend:(feature:string)=>feature==='trips',
}))
afterEach(()=>vi.unstubAllGlobals())
test('customer page owns a focusable vertical scroll region; expansion does not create per-card scrollers',async()=>{
  connectApiAuth(()=>Promise.resolve('fixture-token'))
  const rows=Array.from({length:36},(_,i)=>({
    id:i+1,customerId:i+1,customerName:'Fixture '+(i+1),companyId:1,destination:'Fixture',
    deadline:'2099-12-31T17:00:00',priority:'NORMAL',status:'PENDING',
    expectedPackageCount:4,receivedPackageCount:3,packageIds:[],tripId:null,createdAt:'2026-11-11T08:00:00',
  }))
  const {calls}=stubBackend({'GET /api/delivery-requirements':{body:{success:true,data:rows,last:true,totalPages:1}}})
  render(<I18nProvider><WarehouseCustomersPage/></I18nProvider>)
  const last=await screen.findByRole('button',{name:/Fixture 36/})
  const main=screen.getByRole('main')
  expect(main).toHaveClass('min-h-0','overflow-y-auto')
  expect(main).toHaveAttribute('tabindex','0')
  expect(main).toHaveAccessibleName('Khách hàng gửi hàng')
  await userEvent.click(last)
  expect(last).toHaveAttribute('aria-expanded','true')
  expect(screen.getByText('Yêu cầu giao #36')).toBeInTheDocument()
  await userEvent.click(last)
  expect(last).toHaveAttribute('aria-expanded','false')
  expect(calls.every(call=>call.method==='GET')).toBe(true)
})
