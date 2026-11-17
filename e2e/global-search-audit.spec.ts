import {expect,test} from './fixtures'

for(const role of ['dispatcher','warehouse'] as const){
 test('exact Package lookup refuses unrelated rows and preserves read permission: '+role,async({page,login,browserErrors},info)=>{
  const unexpected:string[]=[]
  const requests:string[]=[]
  await page.route('**/*',route=>{
   if(['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname))return route.fallback()
   unexpected.push('external blocked');return route.abort()
  })
  await page.route('https://fonts.googleapis.com/**',r=>r.fulfill({contentType:'text/css',body:'/* fixture */'}))
  await page.route('**/src/lib/backend-config.ts*',r=>r.fulfill({contentType:'application/javascript',
   body:"export const BACKEND_FEATURES=['packages'];export const backendConfig={authSource:'mock',apiUrl:location.origin,features:new Set(['packages']),keycloak:{url:'',realm:'',clientId:''}};export const usesBackend=(n)=>n==='packages';export const resolveBackendConfig=()=>backendConfig;"}))
  await page.route('**/src/lib/api-client.ts*',async r=>{
   const response=await r.fetch();await r.fulfill({response,body:(await response.text())+"\nconnectApiAuth(()=>Promise.resolve('fixture-token'));\n"})
  })
  const p={id:1,orderId:null,packageTypeId:null,companyId:1,packageCode:'EXACT CODE',qrToken:'00000000-0000-4000-8000-000000000001',
   trackingBarcode:'TRACK-1',actualLength:40,actualWidth:30,actualHeight:20,actualWeightKg:3,isPinned:false,handlingClass:'STANDARD',status:'PENDING',destination:'Fixture'}
  await page.route('**/api/**',r=>{
   const req=r.request();const url=new URL(req.url());const path=url.pathname
   requests.push(req.method()+' '+path)
   if(req.method()==='GET'&&path==='/api/packages'){
    const code=url.searchParams.get('packageCode')?.trim().toLowerCase()
    if(code==='server-error')return r.fulfill({status:500,json:{success:false,code:'INTERNAL_SERVER_ERROR'}})
    // Deliberately hostile/old-server fixture: unknown code returns an unrelated row.
    return r.fulfill({json:{success:true,data:[code==='exact code'?p:{...p,packageCode:'UNRELATED'}],page:0,totalPages:1,last:true}})
   }
   if(req.method()==='GET'&&path==='/api/packages/scan/'+p.qrToken)return r.fulfill({json:{success:true,data:{...p,trip:null,stop:null}}})
   unexpected.push(req.method()+' '+path);return r.fulfill({status:500,json:{success:false}})
  })
  await login('/tra-cuu-kien',role)
  const input=page.getByLabel('Mã QR hoặc mã kiện của bên gửi',{exact:true})
  await expect(input).toBeVisible()
  await input.fill('NOT-PRESENT')
  await page.getByRole('button',{name:'Tra cứu',exact:true}).click()
  await expect(page.getByText('Không tìm thấy kiện hàng phù hợp',{exact:true})).toBeVisible()
  await expect(page.getByText('UNRELATED',{exact:true})).toHaveCount(0)
  expect(requests.some(r=>r.includes('/scan/'))).toBe(false)
  await page.screenshot({path:info.outputPath(role+'-unknown-code.png')})
  await input.fill('  exact code  ')
  await page.getByRole('button',{name:'Tra cứu',exact:true}).click()
  await expect(page.getByRole('heading',{name:'EXACT CODE',exact:true})).toBeVisible()
  await expect(page.getByText('UNRELATED',{exact:true})).toHaveCount(0)
  await page.screenshot({path:info.outputPath(role+'-exact-code.png')})
  await input.fill('server-error')
  await page.getByRole('button',{name:'Tra cứu',exact:true}).click()
  await expect(page.getByRole('status').filter({hasText:'Máy chủ gặp lỗi. Thử lại sau.'})).toBeVisible()
  await expect(page.getByRole('heading',{name:'EXACT CODE',exact:true})).toHaveCount(0)
  expect(requests.every(r=>r.startsWith('GET '))).toBe(true)
  expect(unexpected).toEqual([])
  expect(browserErrors).toEqual([])
 })
}
