import { expect, test } from './fixtures'

for (const [width, height] of [[1920,1080],[1366,768],[820,1180],[390,844]] as const) {
  test.describe('viewport '+width, () => {
  test.use({hasTouch:width<=820})
  test('warehouse customer scroll ' + width, async ({ page, login, browserErrors }, info) => {
    await page.setViewportSize({ width, height })
    const unexpected: string[] = []
    await page.route('**/*', route => {
      if (['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)) return route.fallback()
      unexpected.push('external blocked'); return route.abort()
    })
    await page.route('https://fonts.googleapis.com/**', route => route.fulfill({ contentType: 'text/css', body: '/* fixture */' }))
    await page.route('**/src/lib/backend-config.ts*', route => route.fulfill({
      contentType: 'application/javascript',
      body: "export const BACKEND_FEATURES=['trips']; export const backendConfig={authSource:'mock',apiUrl:location.origin,features:new Set(['trips']),keycloak:{url:'',realm:'',clientId:''}}; export const usesBackend=(n)=>n==='trips'; export const resolveBackendConfig=()=>backendConfig;",
    }))
    await page.route('**/src/lib/api-client.ts*', async route => {
      const response = await route.fetch()
      await route.fulfill({ response, body: (await response.text())+"\nconnectApiAuth(()=>Promise.resolve('fixture-token'));\n" })
    })
    let count=36
    const row = (customer: number, extra=0) => ({
      id: customer*100+extra, companyId: 1, customerId: customer,
      customerName: 'Khách fixture '+String(customer).padStart(2,'0'),
      destination: 'Địa chỉ fixture '+customer, deadline: '2099-12-31T17:00:00', priority: 'NORMAL',
      status: 'PENDING', expectedPackageCount: 4, receivedPackageCount: 3, packageIds: [],
      tripId: null, createdAt: '2026-11-11T08:00:00', createdBy: 8,
    })
    await page.route('**/api/**', route => {
      const request=route.request()
      if (request.method()==='GET' && new URL(request.url()).pathname==='/api/delivery-requirements') {
        const rows=Array.from({length:count},(_,i)=>row(i+1))
        if(count===36)for(let i=1;i<=24;i++)rows.push(row(36,i))
        return route.fulfill({ json: {success:true,data:rows,page:0,size:100,totalPages:1,totalElements:rows.length,last:true} })
      }
      unexpected.push(request.method()+' '+new URL(request.url()).pathname)
      return route.fulfill({status:500,json:{success:false}})
    })
    await login('/kho-khach-hang','warehouse')
    const main=page.getByRole('main')
    const last=page.getByRole('button',{name:/Khách fixture 36/})
    await expect(last).toHaveCount(1)
    await page.screenshot({path:info.outputPath('top-'+width+'.png')})
    const bounds=await main.boundingBox()
    await page.mouse.move(bounds!.x+bounds!.width/2,bounds!.y+Math.min(bounds!.height/2,300))
    await page.mouse.wheel(0,10000)
    await expect.poll(()=>main.evaluate(el=>el.scrollTop)).toBeGreaterThan(0)
    await expect(last).toBeInViewport()
    await page.screenshot({path:info.outputPath('bottom-'+width+'.png')})
    const lastBounds=await last.boundingBox()
    expect(lastBounds!.y).toBeGreaterThanOrEqual(bounds!.y)
    expect(lastBounds!.y+lastBounds!.height).toBeLessThanOrEqual(height)
    await page.mouse.click(lastBounds!.x+lastBounds!.width/2,lastBounds!.y+lastBounds!.height/2)
    await expect(last).toHaveAttribute('aria-expanded','true')
    // End/PageDown use the actual scroll container, never scrollIntoView to prove scrollability.
    await main.focus()
    await page.keyboard.press('End')
    await expect(page.getByText('Yêu cầu giao #3624',{exact:true})).toBeInViewport()
    await page.screenshot({path:info.outputPath('expanded-bottom-'+width+'.png')})
    await page.keyboard.press('Home')
    await expect.poll(()=>main.evaluate(el=>el.scrollTop)).toBe(0)
    if(width<=820){
      const session=await page.context().newCDPSession(page)
      const x=Math.round(bounds!.x+bounds!.width/2)
      const startY=Math.round(bounds!.y+bounds!.height*0.75)
      await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y:startY}]})
      for(let step=1;step<=12;step++){
        await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:startY-step*30}]})
        await page.waitForTimeout(20) // A physical swipe spans frames; no programmatic scrollTop change.
      }
      await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
      await expect.poll(()=>main.evaluate(el=>el.scrollTop)).toBeGreaterThan(0)
      await session.detach()
      await main.focus();await page.keyboard.press('Home')
      await expect.poll(()=>main.evaluate(el=>el.scrollTop)).toBe(0)
    }
    await page.keyboard.press('PageDown')
    await expect.poll(()=>main.evaluate(el=>el.scrollTop)).toBeGreaterThan(0)
    await page.keyboard.press('End')
    await last.click()
    await expect(last).toHaveAttribute('aria-expanded','false')
    const metrics=await main.evaluate(el=>({
      width:el.clientWidth,scrollWidth:el.scrollWidth,bodyTop:document.scrollingElement?.scrollTop,
      documentWidth:document.documentElement.scrollWidth,navTop:document.querySelector('.app-shell > header')?.getBoundingClientRect().top,
      nested:[...el.querySelectorAll('*')].filter(n=>getComputedStyle(n).overflowY==='auto').length,
    }))
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.width+1)
    expect(metrics.bodyTop).toBe(0)
    expect(metrics.documentWidth).toBeLessThanOrEqual(width+1)
    expect(metrics.navTop).toBe(0)
    expect(metrics.nested).toBe(0)
    for(const size of [1,10,36]){
      count=size
      await page.reload()
      await expect(page.getByRole('button',{name:/Khách fixture/})).toHaveCount(size)
      await main.focus(); await page.keyboard.press('End')
      await expect(page.getByRole('button',{name:new RegExp('Khách fixture '+String(size).padStart(2,'0'))})).toBeInViewport()
    }
    // Real browser history return, with a fresh component/read, must retain usable scrolling.
    await page.goto('/ho-so')
    await page.goBack()
    await expect(page.getByRole('button',{name:/Khách fixture 36/})).toHaveCount(1)
    await main.focus();await page.keyboard.press('End')
    await expect(page.getByRole('button',{name:/Khách fixture 36/})).toBeInViewport()
    expect(unexpected).toEqual([])
    expect(browserErrors).toEqual([])
    await info.attach('scroll-metrics',{body:JSON.stringify(metrics),contentType:'application/json'})
  })
  })
}
