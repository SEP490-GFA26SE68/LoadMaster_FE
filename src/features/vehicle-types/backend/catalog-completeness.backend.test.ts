import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {connectApiAuth} from '@/lib/api-client'
import {catalogPage,catalogType} from '@/test/vehicle-type-catalog-fixture'
import {fetchAllVehicleTypes} from './vehicle-types-api'
import {fetchBackendTripFormOptions} from '@/features/trips/trips-backend-api'
import {getMockDb} from '@/lib/mock-db'
vi.mock('@/lib/backend-config',()=>({backendConfig:{authSource:'keycloak',apiUrl:'http://be.test',features:new Set(['fleet','trips']),keycloak:{url:'',realm:'',clientId:''}},usesBackend:()=>true}))
beforeEach(()=>connectApiAuth(async()=>'fixture'))
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();connectApiAuth(async()=>null)})
test.each([21,50,100,101])('catalog %i rows is complete and maps obstacles/geometry unchanged',async count=>{
 const calls:URL[]=[]
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{const u=new URL(input);calls.push(u);return Response.json(catalogPage(u,count))}))
 const rows=await fetchAllVehicleTypes()
 expect(rows).toHaveLength(count);expect(rows.at(-1)).toMatchObject({id:String(count),name:'Type '+String(count).padStart(3,'0'),cargoLengthCm:400,payloadKg:count*100,obstacles:[]})
 expect(calls).toHaveLength(Math.ceil(count/100))
})
test('catalog cannot return incomplete data at 50 page cap',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{const p=Number(new URL(input).searchParams.get('page'));return Response.json({success:true,data:[catalogType(p+1)],page:p,totalPages:51,totalElements:51,last:false})}))
 await expect(fetchAllVehicleTypes()).rejects.toMatchObject({code:'DATASET_INCOMPLETE'})
})
test('catalog errors remain errors, not successful empty',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({success:false,code:'FORBIDDEN'},{status:403})))
 await expect(fetchAllVehicleTypes()).rejects.toMatchObject({status:403})
})
test('Trip form type lookup also refuses incomplete catalog',async()=>{
 vi.spyOn(getMockDb(),'listCompanies').mockResolvedValue([])
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
 const u=new URL(input),p=Number(u.searchParams.get('page'))
 if(u.pathname==='/api/vehicle-types')return Response.json({success:true,data:[catalogType(p+1)],page:p,totalPages:51,totalElements:51,last:p===50})
 if(u.pathname==='/api/trips/driver-options')return Response.json({success:true,data:[]})
 return Response.json({success:true,data:[],page:0,totalPages:0,totalElements:0,last:true})
 }))
 await expect(fetchBackendTripFormOptions()).rejects.toMatchObject({code:'DATASET_INCOMPLETE'})
})
