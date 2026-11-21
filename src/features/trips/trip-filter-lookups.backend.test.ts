import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {connectApiAuth} from '@/lib/api-client'
import {fetchTripFilterVehicles,fetchTripFilterDrivers,retainSelected} from './trip-filter-lookups'
import {fetchAssignableTrips} from '@/features/requirements/backend/requirements-api'
vi.mock('@/lib/backend-config',()=>({backendConfig:{authSource:'keycloak',apiUrl:'http://be.test',features:new Set(['trips']),keycloak:{url:'',realm:'',clientId:''}},usesBackend:()=>true}))
beforeEach(()=>connectApiAuth(async()=>'fixture'))
afterEach(()=>vi.unstubAllGlobals())
test('vehicle lookup loads later pages and preserves selected labels',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{const page=Number(new URL(input).searchParams.get('page'));return Response.json({success:true,data:page===0?[{id:1,name:'First'}]:[{id:130,name:'Last'}],page,totalPages:2,totalElements:2,last:page===1})}))
 const rows=await fetchTripFilterVehicles();expect(rows.map(r=>r.value)).toEqual(['1','130'])
 expect(retainSelected(rows,'130','Vehicle')).toEqual(rows)
 expect(retainSelected(rows,'999','Vehicle').at(-1)).toEqual({value:'999',label:'Vehicle #999'})
})
test('lookup exhaustion cannot masquerade as complete',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{const page=Number(new URL(input).searchParams.get('page'));return Response.json({success:true,data:[{id:page+1}],page,totalPages:51,totalElements:51,last:false})}))
 await expect(fetchTripFilterVehicles()).rejects.toMatchObject({code:'DATASET_INCOMPLETE'})
})
test('driver error cannot become empty options',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({success:false,code:'FORBIDDEN'},{status:403})))
 await expect(fetchTripFilterDrivers()).rejects.toMatchObject({status:403})
})
test('assignable DRAFT trip after first page is retained with numeric ID for POST',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{const u=new URL(input),page=Number(u.searchParams.get('page'));expect(u.searchParams.get('status')).toBe('DRAFT');return Response.json({success:true,data:[{id:page===0?1:290,tripCode:page===0?'FIRST':'LATE',tripName:'Fixture',status:'DRAFT',departureTime:'2026-11-12T08:00:00'}],page,totalPages:2,totalElements:2,last:page===1})}))
 expect((await fetchAssignableTrips()).map(r=>[r.id,r.code])).toEqual([['1','FIRST'],['290','LATE']])
})
test('assignment lookup missing paging metadata rejects rather than hide eligible trips',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({success:true,data:[]})))
 await expect(fetchAssignableTrips()).rejects.toMatchObject({code:'INVALID_PAGE_RESPONSE'})
})
