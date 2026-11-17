import {act,render,screen} from '@testing-library/react'
import {createMemoryRouter,RouterProvider} from 'react-router'
import {expect,test} from 'vitest'
import {useListUrlState} from './useListUrlState'

function Probe(){
 const list=useListUrlState({filters:['status']})
 return <><output data-testid="state">{JSON.stringify({q:list.query,status:list.filters.status,sort:list.sorting,page:list.pageIndex,size:list.pageSize})}</output>
 <button onClick={list.clearAll}>Clear</button></>
}
const state=()=>JSON.parse(screen.getByTestId('state').textContent??'{}') as unknown
test('back/forward restores query, filters, sort and page; remount simulates reload; clear preserves sort and size',async()=>{
 const older='/list?q=old&status=active&sap-xep=-n&trang=3&so-dong=50'
 const newer='/list?q=new&status=ready&sap-xep=n&trang=2&so-dong=100'
 const router=createMemoryRouter([{path:'*',element:<Probe/>}],{initialEntries:[older,newer]})
 const view=render(<RouterProvider router={router}/>)
 expect(state()).toEqual({q:'new',status:'ready',sort:[{id:'n',desc:false}],page:1,size:100})
 await act(async()=>{await router.navigate(-1)})
 expect(state()).toEqual({q:'old',status:'active',sort:[{id:'n',desc:true}],page:2,size:50})
 await act(async()=>{await router.navigate(1)})
 expect(state()).toEqual({q:'new',status:'ready',sort:[{id:'n',desc:false}],page:1,size:100})
 const saved=router.state.location.pathname+router.state.location.search
 view.unmount()
 const reload=createMemoryRouter([{path:'*',element:<Probe/>}],{initialEntries:[saved]})
 render(<RouterProvider router={reload}/>)
 expect(state()).toEqual({q:'new',status:'ready',sort:[{id:'n',desc:false}],page:1,size:100})
 await act(async()=>{screen.getByRole('button',{name:'Clear'}).click()})
 expect(state()).toEqual({q:'',status:'',sort:[{id:'n',desc:false}],page:0,size:100})
 expect(reload.state.location.search).toBe('?sap-xep=n&so-dong=100')
})
