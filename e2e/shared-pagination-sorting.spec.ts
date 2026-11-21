import {expect,test} from './fixtures'

async function openFixture(page:import('@playwright/test').Page,mode:string){
 const calls:string[]=[]
 let releaseFirstSort:()=>void=()=>{}
 const firstSort=new Promise<void>(resolve=>{releaseFirstSort=resolve})
 let held=false
 await page.route('**/*',r=>{
  if(['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname))return r.fallback()
  return r.abort()
 })
 await page.route('**/__shared-table**',async r=>{
  const response=await r.fetch({url:new URL('/',r.request().url()).href})
  await r.fulfill({response,body:(await response.text()).replace('/src/main.tsx','/src/test/browser/shared-table-harness.tsx')})
 })
 await page.route('**/__fixture/rows*',async r=>{
  expect(r.request().method()).toBe('GET')
  const q=new URL(r.request().url()).searchParams
  calls.push(q.toString())
  const index=Number(q.get('page')),size=Number(q.get('size'))
  const rows=Array.from({length:60},(_,i)=>({id:i+1,n:i+1}))
  if(q.get('desc')==='true'){
   rows.reverse()
   if(index===0&&!held){held=true;await firstSort}
  }
  await r.fulfill({json:{success:true,data:rows.slice(index*size,(index+1)*size),page:index,size,totalElements:60,totalPages:Math.ceil(60/size),last:(index+1)*size>=60}})
 })
 await page.goto('/__shared-table?mode='+mode)
 await expect(page.getByRole('table')).toBeVisible()
 await expect(page.getByText('1–25 / 60',{exact:true})).toBeVisible()
 return {calls,releaseFirstSort}
}
const first=(page:import('@playwright/test').Page)=>page.locator('tbody tr td').first()

test('shared server table keeps old order until server ACK, sorts globally and pages without changing total',async({page,browserErrors},info)=>{
 const {releaseFirstSort}=await openFixture(page,'server')
 await expect(first(page)).toHaveText('1')
 await page.getByRole('button',{name:'Number',exact:true}).click()
 await expect(first(page)).toHaveText('1')
 releaseFirstSort()
 await expect(first(page)).toHaveText('60')
 await page.getByRole('button',{name:'Trang sau',exact:true}).click()
 await expect(first(page)).toHaveText('35')
 await expect(page.getByText('26–50 / 60',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Trang sau',exact:true}).click()
 await expect(first(page)).toHaveText('10')
 await expect(page.getByText('51–60 / 60',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Number',exact:true}).click()
 await expect(first(page)).toHaveText('1')
 await expect(page.getByText('1–25 / 60',{exact:true})).toBeVisible()
 await page.screenshot({path:info.outputPath('server.png')})
 expect(browserErrors).toEqual([])
})
test('shared client complete dataset sorts before paging and searches all rows',async({page,browserErrors},info)=>{
 const {calls}=await openFixture(page,'client')
 expect(calls).toHaveLength(3)
 await page.getByRole('button',{name:'Number',exact:true}).click()
 await expect(first(page)).toHaveText('60')
 await page.getByRole('button',{name:'Trang sau',exact:true}).click()
 await expect(first(page)).toHaveText('35')
 await expect(page.getByText('26–50 / 60',{exact:true})).toBeVisible()
 await page.getByRole('textbox',{name:'Search',exact:true}).fill('59')
 await expect(first(page)).toHaveText('59')
 await expect(page.getByText('1–1 / 1',{exact:true})).toBeVisible()
 expect(calls).toHaveLength(3)
 await page.reload()
 await expect(first(page)).toHaveText('59')
 await expect(page.getByText('1–1 / 1',{exact:true})).toBeVisible()
 expect(calls).toHaveLength(6)
 await page.screenshot({path:info.outputPath('client.png')})
 expect(browserErrors).toEqual([])
})
test('shared server table without sort support disables controls and explains server order',async({page,browserErrors})=>{
 const {calls}=await openFixture(page,'unsupported')
 await expect(page.getByRole('button',{name:'Number',exact:true})).toHaveCount(0)
 await expect(page.getByRole('status').filter({hasText:'Hiển thị theo thứ tự máy chủ.'})).toBeVisible()
 await expect(first(page)).toHaveText('1')
 expect(calls).toHaveLength(1)
 expect(browserErrors).toEqual([])
})
