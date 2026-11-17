import { ApiError, apiFetch } from '@/lib/api-client'
import { usesBackend } from '@/lib/backend-config'
export type WarehouseStaff = { userId: number; fullName: string; status: string }
export type StaffAssignment = WarehouseStaff & { active: boolean }
export type AssignmentChange = {
  id: number; actorId: number; actorName: string | null; userId: number
  oldActive: boolean | null; newActive: boolean; recordedAt: string
}
const base = '/api/company-warehouses'
async function request<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (!usesBackend('companies')) throw new ApiError('NOT_SUPPORTED')
  return (await apiFetch<{ data: T }>(path, {
    method, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })).data
}
export const getWarehouseStaff = () => request<WarehouseStaff[]>(`${base}/staff`)
export const getStaffAssignments = (warehouse: number) => request<StaffAssignment[]>(`${base}/${warehouse}/staff-assignments`)
export const getAssignmentHistory = (warehouse: number, page: number) => request<AssignmentChange[]>(`${base}/${warehouse}/staff-assignments/history?page=${page}`)
export const assignWarehouseStaff = (warehouse: number, userId: number) => request<StaffAssignment[]>(`${base}/${warehouse}/staff-assignments`, 'POST', { userId })
export const revokeWarehouseStaff = (warehouse: number, userId: number) => request<StaffAssignment[]>(`${base}/${warehouse}/staff-assignments/${userId}`, 'DELETE')
