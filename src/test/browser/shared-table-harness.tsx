import {createRoot} from 'react-dom/client'
import {BrowserRouter} from 'react-router'
import {useEffect,useState} from 'react'
import {createColumnHelper} from '@tanstack/react-table'
import {DataTable,type BaseTableFeatures} from '@/components/DataTable'
import {useListUrlState} from '@/components/useListUrlState'
import {I18nProvider} from '@/lib/i18n'
import {createApiClient} from '@/lib/api-client'
import {fetchAllPages} from '@/lib/api-page'
import '@/index.css'

type Row={id:number;n:number}
const helper=createColumnHelper<BaseTableFeatures,Row>()
const columns=helper.columns([helper.accessor('n',{header:'Number',enableSorting:true})])
const client=createApiClient({baseUrl:window.location.origin,accessToken:async()=>null})
function Fixture(){
 const mode=new URLSearchParams(window.location.search).get('mode')??'client'
 const server=mode!=='client'
 const list=useListUrlState({defaultSort:{id:'n',desc:false}})
 const [data,setData]=useState<Row[]>([])
 const [total,setTotal]=useState(0)
 const [error,setError]=useState(false)
 const sortDesc=list.sorting[0]?.desc??false
 const requestPage=server?list.pageIndex:0
 const requestSize=server?list.pageSize:25
 const requestDesc=server?sortDesc:false
 useEffect(()=>{
  let cancelled=false
  const request=server
   ?client.getRaw('/__fixture/rows',{query:{page:requestPage,size:requestSize,desc:requestDesc}})
    .then(raw=>{const value=raw as {data:Row[];totalElements:number};return {rows:value.data,total:value.totalElements}})
   :fetchAllPages<Row>('/__fixture/rows',{size:25},client).then(rows=>({rows,total:rows.length}))
  void request.then(value=>{if(!cancelled){setData(value.rows);setTotal(value.total);setError(false)}})
   .catch(()=>{if(!cancelled)setError(true)})
  return ()=>{cancelled=true}
 },[server,requestPage,requestSize,requestDesc])
 const filtered=server?data:data.filter(row=>String(row.n).includes(list.query))
 return <main className="p-8"><h1 className="mb-4 text-title-lg">Shared table fixture</h1>
  {!server?<input aria-label="Search" value={list.query} onChange={e=>list.setQuery(e.target.value)}/>:null}
  {error?<p role="alert">Fixture error</p>:null}
  <DataTable data={filtered} columns={columns} serverPagination={server} serverSorting={mode==='server'}
   totalRows={total} sorting={list.sorting} onSortingChange={list.setSorting}
   pagination={{pageIndex:list.pageIndex,pageSize:list.pageSize,onPageChange:list.setPage,onPageSizeChange:list.setPageSize}}
   isFiltering={list.isFiltering} onClearFilters={list.clearAll}/>
 </main>
}
createRoot(document.getElementById('root')!).render(<I18nProvider><BrowserRouter><Fixture/></BrowserRouter></I18nProvider>)
