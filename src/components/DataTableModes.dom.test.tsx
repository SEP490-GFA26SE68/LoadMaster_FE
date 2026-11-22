import {createColumnHelper} from '@tanstack/react-table'
import {render,screen,within} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {expect,test,vi} from 'vitest'
import {DataTable,type BaseTableFeatures} from './DataTable'
import {I18nProvider} from '@/lib/i18n'

type Row={id:string;n:number;at:Date}
const h=createColumnHelper<BaseTableFeatures,Row>()
const columns=h.columns([h.accessor('n',{header:'Number',enableSorting:true}),
 h.accessor('at',{header:'Date',enableSorting:true,cell:x=>x.getValue().toISOString()})])
const data=[{id:'one',n:1,at:new Date('2026-01-01Z')},{id:'nine',n:9,at:new Date('2026-02-01Z')}]
const values=()=>within(screen.getAllByRole('rowgroup')[1]!).getAllByRole('row').map(r=>within(r).getAllByRole('cell')[0]?.textContent)
test('serverPagination preserves server order [1,9] despite controlled DESC state',()=>{
 render(<I18nProvider><DataTable data={data} columns={columns} serverPagination totalRows={51}
 sorting={[{id:'n',desc:true}]} onSortingChange={()=>{}}
 pagination={{pageIndex:0,pageSize:2,onPageChange:()=>{},onPageSizeChange:()=>{}}}/></I18nProvider>)
 expect(values()).toEqual(['1','9'])
 expect(screen.queryByRole('button',{name:'Number'})).toBeNull()
 expect(screen.getByText('1–2 / 51')).toBeInTheDocument()
})
test('client complete dataset sorts numeric DESC before pagination',()=>{
 render(<I18nProvider><DataTable data={data} columns={columns} sorting={[{id:'n',desc:true}]} onSortingChange={()=>{}}
 pagination={{pageIndex:0,pageSize:1,onPageChange:()=>{},onPageSizeChange:()=>{}}}/></I18nProvider>)
 expect(values()).toEqual(['9'])
 expect(screen.getByText('1–1 / 2')).toBeInTheDocument()
})
test('client dates sort by chronological order',()=>{
 render(<I18nProvider><DataTable data={data} columns={columns} sorting={[{id:'at',desc:true}]} onSortingChange={()=>{}}/></I18nProvider>)
 expect(values()).toEqual(['9','1'])
})
test('unsupported server sorting never dispatches a fake local sort',async()=>{
 const change=vi.fn()
 render(<I18nProvider><DataTable data={data} columns={columns} serverPagination sorting={[{id:'n',desc:true}]} onSortingChange={change}/></I18nProvider>)
 expect(screen.queryByRole('button',{name:'Number'})).toBeNull()
 expect(change).not.toHaveBeenCalled()
 // Paging remains available through its own controlled handlers.
 expect(values()).toEqual(['1','9'])
})

test('server sorting opt-in dispatches a request but never reorders the old page',async()=>{
 const change=vi.fn()
 const view=render(<I18nProvider><DataTable data={data} columns={columns} serverPagination serverSorting
 sorting={[{id:'n',desc:false}]} onSortingChange={change}/></I18nProvider>)
 await userEvent.setup().click(screen.getByRole('button',{name:'Number'}))
 expect(change).toHaveBeenCalledWith([{id:'n',desc:true}])
 expect(values()).toEqual(['1','9'])
 view.rerender(<I18nProvider><DataTable data={[data[1]!,data[0]!]} columns={columns} serverPagination serverSorting
 sorting={[{id:'n',desc:true}]} onSortingChange={change}/></I18nProvider>)
 expect(values()).toEqual(['9','1'])
})
