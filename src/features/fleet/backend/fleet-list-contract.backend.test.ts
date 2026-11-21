import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {connectApiAuth} from '@/lib/api-client'
import {fetchVehicles} from './vehicles-api'
vi.mock('@/lib/backend-config',()=>({backendConfig:{authSource:'keycloak',apiUrl:'http://be.test',features:new Set(['fleet']),keycloak:{url:'',realm:'',clientId:''}},usesBackend:(f:string)=>f==='fleet'}))
beforeEach(()=>connectApiAuth(async()=>'fixture'))
afterEach(()=>{vi.unstubAllGlobals();connectApiAuth(async()=>null)})
test('wire carries combined filter and server sorting parameters',async()=>{
 const calls:URL[]=[]
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{calls.push(new URL(input));return Response.json({success:true,data:[],page:0,size:25,totalElements:0,totalPages:0,last:true})}))
 await fetchVehicles(0,25,'PLATE-07','2',{status:'MAINTENANCE',sortBy:'licensePlate',sortDir:'DESC'})
 expect(Object.fromEntries(calls[0]!.searchParams)).toEqual({page:'0',size:'25',search:'PLATE-07',vehicleTypeId:'2',status:'MAINTENANCE',sortBy:'licensePlate',sortDir:'DESC'})
})
test('HTTP errors propagate instead of being successful empty rows',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({success:false,code:'FORBIDDEN'},{status:403})))
 await expect(fetchVehicles()).rejects.toMatchObject({status:403})
})
