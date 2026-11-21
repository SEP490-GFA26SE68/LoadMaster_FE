import {useQuery} from '@tanstack/react-query'
import {useAuth} from '@/features/auth/AuthProvider'
import {fetchAllPages} from '@/lib/api-page'
import {apiFetch,ApiError} from '@/lib/api-client'
import type {VehicleApi} from '@/features/fleet/backend/vehicles-api'
import type {FilterOption} from './trip-list'

/** Existing tenant-scoped read APIs. Never infer the option universe from a Trip page. */
export async function fetchTripFilterVehicles():Promise<FilterOption[]> {
 const rows=await fetchAllPages<VehicleApi>('/api/vehicles',{size:100})
 return rows.map(v=>({value:String(v.id),label:[v.name,v.licensePlate].filter(Boolean).join(' \u00b7 ')}))
}
export async function fetchTripFilterDrivers():Promise<FilterOption[]> {
 const response=await apiFetch<{success:boolean;data:{id:number;fullName:string}[]}>('/api/trips/driver-options')
 if(response.success!==true || !Array.isArray(response.data))throw new ApiError('INVALID_PAGE_RESPONSE')
 return response.data.map(d=>({value:String(d.id),label:d.fullName}))
}
/** A selected URL value stays explicit if retired/deactivated or unavailable; never borrow another tenant's label. */
export function retainSelected(options:FilterOption[],selected:string,label:string):FilterOption[]{
 return !selected || options.some(o=>o.value===selected)?options:[...options,{value:selected,label:label+' #'+selected}]
}
export function useTripFilterLookups(){
 const {user}=useAuth()
 const identity=[user?.companyId,user?.id]
 const vehicles=useQuery({queryKey:['trips','filter-vehicles',...identity],queryFn:fetchTripFilterVehicles,staleTime:0})
 // Existing endpoint is DISPATCHER-only. Do not widen Manager privileges for a dropdown.
 const drivers=useQuery({queryKey:['trips','filter-drivers',...identity],queryFn:fetchTripFilterDrivers,enabled:user?.role==='dispatcher',staleTime:0})
 return {vehicles,drivers}
}
