import { api, apiFetch } from '@/lib/api-client'
export type Presence = { vehicleId: number; warehouseId: number | null; status: 'UNKNOWN' | 'AT_WAREHOUSE' | 'IN_TRANSIT'; observedAt: string | null; actorId: number | null; actorName: string | null }
export type PresenceVehicle = { id: number; name: string; license_plate: string; status: string; presence_status: Presence['status']; current_warehouse_id: number | null; observed_at: string | null; actor_name: string | null; current_warehouse_name?: string | null; loading_trip_id?: number | null; loading_trip_code?: string | null }
export type PresenceEvent = { id: number; eventType: string; actorId: number; recordedAt: string; warehouseId: number; previousStatus: string; newStatus: string }
const path = '/api/warehouse/vehicle-presence'
export const presenceWarehouses = () => api().get<{ id: number; name: string }[]>(`${path}/warehouses`)
export const searchPresenceVehicles = (warehouse: string, query: string) => api().get<PresenceVehicle[]>(`${path}/${warehouse}/search`, { query: { query } })
export const checkInVehicle = async (warehouse: string, vehicleId: number, key: string): Promise<Presence> => (await apiFetch<{ data: Presence }>(`${path}/${warehouse}/check-in`, { method: 'POST', body: JSON.stringify({ vehicleId }), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key } })).data
export const presenceEvents = (warehouse: string, vehicle: number) => api().get<PresenceEvent[]>(`${path}/${warehouse}/vehicles/${vehicle}/events`)

export type PresenceVehiclePage = { success: boolean; data: PresenceVehicle[]; page: number; size: number; totalElements: number; totalPages: number; last: boolean }
/** Dedicated presence read: never use the fleet-management API or infer presence from AVAILABLE. */
export const listPresenceVehicles = (warehouse: string, query: string, page: number) => apiFetch<PresenceVehiclePage>(`${path}/${warehouse}/vehicles?${new URLSearchParams({ query, page: String(page), size: '20' })}`)

/** Physical verification of the server-resolved vehicle for this exact LOADING trip. */
export const confirmLoadingVehicle = async (warehouse: string, trip: number, vehicleId: number, key: string): Promise<Presence> => (await apiFetch<{ data: Presence }>(`${path}/${warehouse}/loading-trips/${trip}/confirm-presence`, { method: 'POST', body: JSON.stringify({ vehicleId }), headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key } })).data
