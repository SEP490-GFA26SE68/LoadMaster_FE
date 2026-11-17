import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {connectApiAuth} from '@/lib/api-client'
import {fetchRequirementsPage} from './requirements-api'
vi.mock('@/lib/backend-config',()=>({backendConfig:{authSource:'keycloak',apiUrl:'http://be.test',features:new Set(['trips']),keycloak:{url:'',realm:'',clientId:''}},usesBackend:()=>true}))
beforeEach(()=>connectApiAuth(async()=>'fixture'))
afterEach(()=>{vi.unstubAllGlobals();connectApiAuth(async()=>null)})
test('requirements wire uses all server filters before paging; tripCode mapping needs no nested trip',async()=>{
 let url:URL|undefined
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{url=new URL(input);return Response.json({success:true,data:[{id:109,companyId:1,customerName:'Customer',destination:'Target',deadline:'2026-11-12T23:59:59',priority:'HIGH',status:'ASSIGNED',tripId:9,tripCode:'TRIP-TARGET',shortDelivered:true,packageIds:[],createdAt:'2026-11-12T08:00:00'}],page:0,size:25,totalElements:1,totalPages:1,last:true})}))
 const page=await fetchRequirementsPage({page:0,size:25,search:'TRIP-TARGET',status:'PARTIAL',priority:'HIGH',deadlineFrom:'2026-11-12',deadlineTo:'2026-11-12',sortBy:'trip',sortDir:'DESC'})
 expect(Object.fromEntries(url!.searchParams)).toEqual({page:'0',size:'25',search:'TRIP-TARGET',status:'PARTIAL',priority:'HIGH',deadlineFrom:'2026-11-12T00:00:00',deadlineTo:'2026-11-13T00:00:00',deadlineToExclusive:'true',sortBy:'trip',sortDir:'DESC'})
 expect(page.data[0]).toMatchObject({status:'PARTIAL',requirement:{id:'109',tripCode:'TRIP-TARGET'},trip:undefined})
 expect(page.totalElements).toBe(1)
})
test('server errors remain errors',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({success:false,code:'FORBIDDEN'},{status:403})))
 await expect(fetchRequirementsPage({page:0,size:25})).rejects.toMatchObject({status:403})
})
