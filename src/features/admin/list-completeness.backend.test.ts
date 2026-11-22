import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {connectApiAuth} from '@/lib/api-client'
import {listCompanyAdmins} from '@/features/platform/company-admins-api'
import {listTrialRequests} from '@/features/platform/trial-requests-api'
vi.mock('@/lib/backend-config',()=>({backendConfig:{authSource:'keycloak',apiUrl:'http://be.test',features:new Set(['companies']),keycloak:{url:'',realm:'',clientId:''}},usesBackend:()=>true}))
beforeEach(()=>connectApiAuth(async()=>'fixture'))
afterEach(()=>{vi.unstubAllGlobals();connectApiAuth(async()=>null)})
test.each([['admins','/api/users',listCompanyAdmins],['trials','/api/trial-requests',listTrialRequests]] as const)('%s reads second page and keeps the target beyond first 200',async(kind,path,read)=>{
 const calls:URL[]=[]
 vi.stubGlobal('fetch',vi.fn(async(input:string)=>{
  const u=new URL(input);calls.push(u);expect(u.pathname).toBe(path)
  if(kind==='admins')expect(u.searchParams.get('role')).toBe('ADMIN')
  const page=Number(u.searchParams.get('page')),size=Number(u.searchParams.get('size'))
  const rows=Array.from({length:205},(_,i)=>({id:i+1,email:'fixture'+i+'@example.test',fullName:'Fixture '+i,status:kind==='admins'?'ACTIVE':'PENDING',createdAt:'2026-11-12T00:00:00Z'}))
  return Response.json({success:true,data:rows.slice(page*size,(page+1)*size),page,size,totalElements:205,totalPages:2,last:page===1})
 }))
 const rows=await read()
 expect(rows).toHaveLength(205);expect(String(rows.at(-1)?.id)).toBe('205');expect(calls).toHaveLength(2)
})
test.each([['admins',listCompanyAdmins],['trials',listTrialRequests]] as const)('%s fails explicitly at cap instead of showing partial as complete',async(_kind,read)=>{
 const fetch=vi.fn(async(input:string)=>{
  const p=Number(new URL(input).searchParams.get('page'))
  return Response.json({success:true,data:[{id:p+1}],page:p,totalPages:51,last:false})
 })
 vi.stubGlobal('fetch',fetch)
 await expect(read()).rejects.toMatchObject({code:'DATASET_INCOMPLETE'});expect(fetch).toHaveBeenCalledTimes(50)
})
