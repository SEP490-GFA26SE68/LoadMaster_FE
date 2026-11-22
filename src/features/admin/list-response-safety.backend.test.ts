import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {connectApiAuth} from '@/lib/api-client'
import {fetchServerAuditLog} from './audit-backend-api'
import {listContracts} from '@/features/platform/contracts-api'
vi.mock('@/lib/backend-config',()=>({backendConfig:{authSource:'keycloak',apiUrl:'http://be.test',features:new Set(['users','billing']),keycloak:{url:'',realm:'',clientId:''}},usesBackend:()=>true}))
beforeEach(()=>connectApiAuth(async()=>'fixture'))
afterEach(()=>{vi.unstubAllGlobals();connectApiAuth(async()=>null)})
test.each([null,{}, {success:true,data:[]}, {success:true,data:[],totalElements:-1}])('malformed Audit response %j is an error rather than empty or invented total',async body=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json(body)))
 await expect(fetchServerAuditLog({page:0,size:50})).rejects.toMatchObject({code:'INVALID_PAGE_RESPONSE'})
})
test('valid empty Audit is distinct from malformed response',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({success:true,data:[],totalElements:0})))
 await expect(fetchServerAuditLog({page:0,size:50})).resolves.toEqual({entries:[],total:0})
})
test('null Contracts payload cannot masquerade as an empty history',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json(null)))
 await expect(listContracts()).rejects.toMatchObject({code:'INVALID_PAGE_RESPONSE'})
})
test('verified unpaged empty Contracts remains valid',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json([])))
 await expect(listContracts()).resolves.toEqual([])
})
