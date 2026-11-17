import {afterEach,beforeEach,expect,test,vi} from 'vitest'
import {lookupPackages,scanPackage} from './package-lookup-api'
import {connectApiAuth} from '@/lib/api-client'
import {stubBackend,envelope} from '@/test/fake-backend'

vi.mock('@/lib/backend-config',()=>({
 backendConfig:{authSource:'mock',apiUrl:'http://be.test',features:new Set(['packages']),keycloak:{url:'',realm:'',clientId:''}},
 usesBackend:(feature:string)=>feature==='packages',
}))
const TOKEN='00000000-0000-4000-8000-000000000001'
const OTHER='00000000-0000-4000-8000-000000000002'
const pkg=(code='EXACT CODE',id=1)=>({id,companyId:1,packageCode:code,qrToken:TOKEN,status:'PENDING',handlingClass:'STANDARD'})
const page=(rows:unknown[])=>({success:true,data:rows,page:0,totalPages:1,last:true})
beforeEach(()=>connectApiAuth(()=>Promise.resolve('fixture-token')))
afterEach(()=>vi.unstubAllGlobals())

test.each(['NOT-PRESENT','EXACT','EXACT  CODE'])('unrelated/partial/internal-space mismatch %s never opens a package',async code=>{
 const {calls}=stubBackend({'GET /api/packages':{body:page([pkg()])},['GET /api/packages/scan/'+TOKEN]:{body:envelope(pkg())}})
 await expect(lookupPackages(code)).rejects.toMatchObject({code:'QR_UNKNOWN'})
 expect(calls.every(c=>c.method==='GET')).toBe(true)
 expect(calls.some(c=>c.path.includes('/scan/'))).toBe(false)
})
test('exact business code trims ends, ignores case, preserves internal space',async()=>{
 const {calls}=stubBackend({'GET /api/packages':{body:page([pkg()])},['GET /api/packages/scan/'+TOKEN]:{body:envelope(pkg())}})
 expect((await lookupPackages('  exact code  ')).map(x=>x.package.id)).toEqual(['1'])
 expect(calls[0]?.query.packageCode).toBe('exact code')
 expect(calls.every(c=>c.method==='GET')).toBe(true)
})
test('numeric business code does not fall back to internal ID',async()=>{
 const {calls}=stubBackend({'GET /api/packages':{body:page([])},'GET /api/packages/123':{body:pkg('DIFFERENT',123)},
 ['GET /api/packages/scan/'+TOKEN]:{body:envelope(pkg('DIFFERENT',123))}})
 await expect(lookupPackages('123')).rejects.toMatchObject({code:'QR_UNKNOWN'})
 expect(calls.map(c=>c.path)).toEqual(['/api/packages'])
})
test('numeric business code matches another ID, never unions the numeric ID',async()=>{
 const {calls}=stubBackend({'GET /api/packages':{body:page([pkg('123',7)])},['GET /api/packages/scan/'+TOKEN]:{body:envelope(pkg('123',7))},
 'GET /api/packages/123':{body:pkg('OTHER',123)}})
 expect((await lookupPackages('123')).map(x=>x.package.id)).toEqual(['7'])
 expect(calls.some(c=>c.path==='/api/packages/123')).toBe(false)
})
test('explicit id: branch checks ID before returning detail',async()=>{
 stubBackend({'GET /api/packages/123':{body:pkg('EXACT CODE',123)},['GET /api/packages/scan/'+TOKEN]:{body:envelope(pkg('EXACT CODE',123))}})
 expect((await lookupPackages('id:123')).map(x=>x.package.id)).toEqual(['123'])
})
test('explicit ID cannot accept another returned ID',async()=>{
 stubBackend({'GET /api/packages/123':{body:pkg('EXACT CODE',7)},['GET /api/packages/scan/'+TOKEN]:{body:envelope(pkg('EXACT CODE',7))}})
 await expect(lookupPackages('id:123')).rejects.toMatchObject({code:'QR_UNKNOWN'})
})
test('raw UUID QR lookup checks returned token',async()=>{
 stubBackend({'GET /api/packages':{body:page([])},['GET /api/packages/scan/'+TOKEN]:{body:envelope(pkg())}})
 expect((await lookupPackages(TOKEN.toUpperCase())).map(x=>x.package.id)).toEqual(['1'])
})
test('QR scan refuses mismatched token',async()=>{
 stubBackend({['GET /api/packages/scan/'+TOKEN]:{body:envelope({...pkg(),qrToken:OTHER})}})
 await expect(scanPackage(TOKEN)).rejects.toMatchObject({code:'QR_UNKNOWN'})
})
test('business-code detail must preserve code, ID and token',async()=>{
 stubBackend({'GET /api/packages':{body:page([pkg()])},['GET /api/packages/scan/'+TOKEN]:{body:envelope(pkg('WRONG',2))}})
 await expect(lookupPackages('EXACT CODE')).rejects.toMatchObject({code:'QR_UNKNOWN'})
})
test('a UUID-shaped business code takes precedence over a different QR package',async()=>{
 const business={...pkg(TOKEN,3),qrToken:OTHER}
 const {calls}=stubBackend({'GET /api/packages':{body:page([business])},['GET /api/packages/scan/'+OTHER]:{body:envelope(business)},
 ['GET /api/packages/scan/'+TOKEN]:{body:envelope(pkg('WRONG',4))}})
 expect((await lookupPackages(TOKEN)).map(x=>x.package.id)).toEqual(['3'])
 expect(calls.some(c=>c.path==='/api/packages/scan/'+TOKEN)).toBe(false)
})
test.each([403,404,500])('list error %i remains an error, never a valid empty/fallback',async status=>{
 stubBackend({'GET /api/packages':{status,body:{success:false,message:'fixture failure'}}})
 await expect(lookupPackages('EXACT CODE')).rejects.toMatchObject({status})
})
test.each([403,500])('detail error %i is not hidden as not-found',async status=>{
 stubBackend({'GET /api/packages':{body:page([pkg()])},['GET /api/packages/scan/'+TOKEN]:{status,body:{success:false}}})
 await expect(lookupPackages('EXACT CODE')).rejects.toMatchObject({status})
})
test('network failure never opens a package',async()=>{
 vi.stubGlobal('fetch',()=>Promise.reject(new TypeError('fixture offline')))
 await expect(lookupPackages('EXACT CODE')).rejects.toBeDefined()
})
test('tracking barcode is not silently treated as internal ID or fuzzy code',async()=>{
 const {calls}=stubBackend({'GET /api/packages':{body:page([])}})
 await expect(lookupPackages('TRACK-123')).rejects.toMatchObject({code:'QR_UNKNOWN'})
 expect(calls.map(c=>c.path)).toEqual(['/api/packages'])
})


test('missing raw business code cannot become a numeric code through DTO display fallback',async()=>{
 const raw={...pkg('IGNORED',123),packageCode:null}
 stubBackend({'GET /api/packages':{body:page([raw])},['GET /api/packages/scan/'+TOKEN]:{body:envelope(raw)}})
 await expect(lookupPackages('123')).rejects.toMatchObject({code:'QR_UNKNOWN'})
})
test('numeric code detail cannot prove code match using a synthesized ID label',async()=>{
 stubBackend({'GET /api/packages':{body:page([pkg('123',123)])},
 ['GET /api/packages/scan/'+TOKEN]:{body:envelope({...pkg('123',123),packageCode:null})}})
 await expect(lookupPackages('123')).rejects.toMatchObject({code:'QR_UNKNOWN'})
})
