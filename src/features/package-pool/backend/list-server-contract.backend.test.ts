import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {connectApiAuth} from '@/lib/api-client'
import {fetchPackages} from './packages-api'
import {fetchPackageTypes} from './package-types-api'
vi.mock('@/lib/backend-config',()=>({backendConfig:{authSource:'keycloak',apiUrl:'http://be.test',features:new Set(['packages']),keycloak:{url:'',realm:'',clientId:''}},usesBackend:(f:string)=>f==='packages'}))
beforeEach(()=>connectApiAuth(async()=>'test'))
afterEach(()=>{vi.unstubAllGlobals();connectApiAuth(async()=>null)})
test('packages send every filter and sort before pagination',async()=>{
 const calls:URL[]=[]
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{calls.push(new URL(input));return Response.json({success:true,data:[],page:0,size:25,totalElements:0,totalPages:0,last:true})}))
 await fetchPackages(0,25,{search:'PKG-126',status:'RETURNED',handlingClass:'FRAGILE',packageTypeId:'61',sortBy:'actualWeightKg',sortDir:'DESC'})
 expect(Object.fromEntries(calls[0]!.searchParams)).toEqual({page:'0',size:'25',search:'PKG-126',status:'RETURNED',handlingClass:'FRAGILE',packageTypeId:'61',sortBy:'actualWeightKg',sortDir:'DESC'})
})
test('types send global search and server sort',async()=>{
 const calls:URL[]=[]
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{calls.push(new URL(input));return Response.json({success:true,data:[],page:0,size:25,totalElements:0,totalPages:0,last:true})}))
 await fetchPackageTypes(0,25,{search:'TYPE-61',sortBy:'name',sortDir:'DESC'})
 expect(Object.fromEntries(calls[0]!.searchParams)).toEqual({page:'0',size:'25',search:'TYPE-61',sortBy:'name',sortDir:'DESC'})
})
test('HTTP errors never become a successful empty list',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({success:false,code:'FORBIDDEN'},{status:403})))
 await expect(fetchPackages()).rejects.toMatchObject({status:403})
 await expect(fetchPackageTypes()).rejects.toMatchObject({status:403})
})
