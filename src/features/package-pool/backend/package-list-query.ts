import type { SortingState } from '@tanstack/react-table'
import type { PackageStatus, HandlingClass } from './packages-api'
export type ListQuery = {search?:string;sortBy?:string;sortDir?:'ASC'|'DESC'}
export type CargoListQuery = ListQuery & {status?:PackageStatus;handlingClass?:HandlingClass;packageTypeId?:string}
export function listParams(page:number,size:number,query:ListQuery):URLSearchParams {
 const params=new URLSearchParams({page:String(page),size:String(size)})
 for(const [key,value] of Object.entries(query)) if(value!==undefined && value!=='') params.set(key,String(value))
 return params
}
export function serverSort(sorting:SortingState, kind:'packages'|'types'):Pick<ListQuery,'sortBy'|'sortDir'> {
 const first=sorting[0]
 const aliases:Record<string,string>=kind==='packages'?{code:'packageCode',weight:'actualWeightKg'}:{lengthCm:'length'}
 return {sortBy:first?(aliases[first.id]??first.id):(kind==='types'?'name':'id'),sortDir:first?.desc?'DESC':'ASC'}
}
