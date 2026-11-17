import {expect,test,vi} from 'vitest'
import {ApiError,createApiClient,type ApiClient} from './api-client'
import {fetchAllPages} from './api-page'

const returning=(...payloads:unknown[])=>{
 const getRaw=vi.fn(async()=>payloads[getRaw.mock.calls.length-1])
 return {client:{getRaw} as unknown as ApiClient,getRaw}
}
test('51 pages must reject at maxPages=50, never return a completed 50-row dataset',async()=>{
 const getRaw=vi.fn(async()=>({data:[{id:getRaw.mock.calls.length}],last:false,totalPages:51,page:getRaw.mock.calls.length-1}))
 await expect(fetchAllPages('/fixture',{maxPages:50},{getRaw} as unknown as ApiClient)).rejects.toMatchObject({code:'DATASET_INCOMPLETE'})
 expect(getRaw).toHaveBeenCalledTimes(50)
})
test('more than 10,000 rows cannot silently truncate at the default limit',async()=>{
 const getRaw=vi.fn(async()=>({data:Array.from({length:200},(_,i)=>({id:(getRaw.mock.calls.length-1)*200+i})),
  page:getRaw.mock.calls.length-1,totalPages:51,totalElements:10001,size:200,last:false}))
 await expect(fetchAllPages('/fixture',{}, {getRaw} as unknown as ApiClient)).rejects.toMatchObject({code:'DATASET_INCOMPLETE'})
 expect(getRaw).toHaveBeenCalledTimes(50)
})
test.each([null,{}, {data:null}, {content:[]}, {data:{content:[]}}, {data:[],totalPages:-1,last:true},
 {data:[1],page:0,totalPages:2,last:true}, {data:[],page:0,totalPages:2,last:false},
 {data:[1],page:1,totalPages:2,last:true}, {data:[1],last:'yes'}, {data:[1],totalPages:1.5,last:true},
 {data:[1],page:0,totalPages:1,last:true,totalElements:2}, {data:[1,2],last:true,totalElements:1},
 {data:[1],size:0,last:true}, {data:[1],totalElements:-1,last:true},
])('malformed or contradictory page rejects: %j',async payload=>{
 const {client}=returning(payload)
 await expect(fetchAllPages('/fixture',{},client)).rejects.toMatchObject({code:'INVALID_PAGE_RESPONSE'})
})
test('valid empty paged dataset and explicitly opted-in unpaged arrays complete successfully',async()=>{
 for(const payload of [{data:[],page:0,totalPages:0,totalElements:0,last:true},[],{data:[]}]){
  const {client,getRaw}=returning(payload)
  await expect(fetchAllPages('/fixture',{allowUnpaged:true},client)).resolves.toEqual([])
  expect(getRaw).toHaveBeenCalledTimes(1)
 }
})
test('last can be inferred from Spring page metadata, including the final short page',async()=>{
 const {client}=returning({data:{content:[1,2],page:{number:0,size:2,totalPages:2,totalElements:3}}},
 {data:{content:[3],page:{number:1,size:2,totalPages:2,totalElements:3}}})
 await expect(fetchAllPages('/fixture',{},client)).resolves.toEqual([1,2,3])
})
test('changing totals during refetch rejects instead of combining snapshots',async()=>{
 const {client}=returning({data:[1],page:0,totalPages:2,totalElements:2,last:false},
 {data:[2],page:1,totalPages:2,totalElements:3,last:true})
 await expect(fetchAllPages('/fixture',{},client)).rejects.toMatchObject({code:'INVALID_PAGE_RESPONSE'})
})
test('a response cannot silently switch from paged to unpaged on the next request',async()=>{
 const {client}=returning({data:[1],last:false},[2])
 await expect(fetchAllPages('/fixture',{},client)).rejects.toMatchObject({code:'INVALID_PAGE_RESPONSE'})
})
test('empty intermediate page is not proof of completion',async()=>{
 const {client}=returning({data:[1],last:false},{data:[],last:false})
 await expect(fetchAllPages('/fixture',{},client)).rejects.toMatchObject({code:'INVALID_PAGE_RESPONSE'})
})
test('overflow page index and repeated first page reject',async()=>{
 const {client}=returning({data:[1],page:0,totalPages:2,last:false},{data:[2],page:0,totalPages:2,last:true})
 await expect(fetchAllPages('/fixture',{},client)).rejects.toMatchObject({code:'INVALID_PAGE_RESPONSE'})
})
test('API error on page two discards accumulated rows',async()=>{
 const failure=new ApiError('UNAUTHORIZED',{status:403})
 const getRaw=vi.fn().mockResolvedValueOnce({data:[1],last:false}).mockRejectedValueOnce(failure)
 await expect(fetchAllPages('/fixture',{}, {getRaw} as unknown as ApiClient)).rejects.toBe(failure)
})
test('request timeout remains an error, never a partial result',async()=>{
 const client=createApiClient({baseUrl:'http://fixture.test',accessToken:async()=>null,timeoutMs:5,
  fetch:((_url,init)=>new Promise((_resolve,reject)=>init?.signal?.addEventListener('abort',()=>reject(new DOMException('timeout','AbortError'))))) as typeof fetch})
 await expect(fetchAllPages('/fixture',{},client)).rejects.toMatchObject({code:'TIMEOUT'})
})
test('concurrent fetchAllPages calls keep their own accumulated rows and totals',async()=>{
 const first=returning({data:[1],last:false},{data:[2],last:true})
 const second=returning({data:[9],last:true})
 await expect(Promise.all([fetchAllPages('/fixture',{},first.client),fetchAllPages('/fixture',{},second.client)])).resolves.toEqual([[1,2],[9]])
})


test('bounded preview makes incompleteness explicit and never masquerades as fetch-all',async()=>{
 const {fetchFirstPage}=await import('./api-page')
 const {client,getRaw}=returning({data:[1],page:0,totalPages:2,last:false,totalElements:2})
 await expect(fetchFirstPage('/fixture',{},client)).resolves.toEqual({rows:[1],complete:false})
 expect(getRaw).toHaveBeenCalledTimes(1)
})
test('a complete bounded preview and invalid limits are explicit',async()=>{
 const {fetchFirstPage}=await import('./api-page')
 const {client,getRaw}=returning({data:[1],page:0,totalPages:1,last:true,totalElements:1})
 await expect(fetchFirstPage('/fixture',{},client)).resolves.toEqual({rows:[1],complete:true})
 await expect(fetchAllPages('/fixture',{maxPages:0},client)).rejects.toBeInstanceOf(RangeError)
 expect(getRaw).toHaveBeenCalledTimes(1)
})


test.each([
 {data:[1],last:false,page:{number:0,totalPages:1,last:true}},
 {data:[1],success:'yes',last:true},
])('conflicting nested metadata or malformed envelope cannot claim completeness: %j',async payload=>{
 const {client}=returning(payload)
 await expect(fetchAllPages('/fixture',{},client)).rejects.toMatchObject({code:'INVALID_PAGE_RESPONSE'})
})


test.each([[1],{success:true,data:[1]}])('paged callers cannot infer completeness from metadata-free arrays: %j',async payload=>{
 const {client}=returning(payload)
 await expect(fetchAllPages('/fixture',{},client)).rejects.toMatchObject({code:'INVALID_PAGE_RESPONSE'})
})
