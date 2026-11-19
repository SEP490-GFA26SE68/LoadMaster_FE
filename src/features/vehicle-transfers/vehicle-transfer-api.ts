import { api, apiFetch } from '@/lib/api-client'
export type TransferStatus = 'REQUESTED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED'
export type Transfer = { id: number; vehicle_id: number; source_warehouse_id: number; destination_warehouse_id: number; status: TransferStatus; vehicle_name?: string; license_plate?: string; source_name?: string; destination_name?: string; reason: string; requested_by: number; requested_at: string; departed_by: number | null; departed_at: string | null; arrived_by: number | null; arrived_at: string | null; cancelled_by: number | null; cancelled_at: string | null }
export type TransferRequest = { vehicleId: number; sourceWarehouseId: number; destinationWarehouseId: number; reason: string }
export type TransferAction = { kind: 'request'; payload: TransferRequest; key: string } | { kind: 'cancel' | 'departure' | 'arrival'; id: number; warehouse?: string; key: string }
export type TransferPage<T = Transfer> = { data: T[]; totalPages: number; last: boolean }
const base = '/api/vehicle-transfers'
export const transferWarehouses = () => api().get<{ id: number; name: string }[]>(`${base}/warehouses`)
export const transferCandidates = (warehouse: string, page: number) => apiFetch<TransferPage<{ id: number; name: string; license_plate: string }>>(`${base}/candidates?${new URLSearchParams({ warehouseId: warehouse, page: String(page) })}`)
export const listTransfers = (warehouse: string | undefined, status: string, page: number) => apiFetch<TransferPage>(`${warehouse ? `/api/warehouse/vehicle-presence/${warehouse}/transfers` : base}?${new URLSearchParams({ status, page: String(page) })}`)
export async function performTransfer(action: TransferAction): Promise<Transfer> {
  const path = action.kind === 'request' ? base : action.kind === 'cancel' ? `${base}/${action.id}/cancel` : `/api/warehouse/vehicle-presence/${action.warehouse}/transfers/${action.id}/${action.kind}`
  return (await apiFetch<{ data: Transfer }>(path, { method: 'POST', headers: { 'Idempotency-Key': action.key, 'Content-Type': 'application/json' }, body: action.kind === 'request' ? JSON.stringify(action.payload) : undefined })).data
}
