/**
 * Đổi xe của chuyến theo máy chủ (nhóm `trips`).
 *   fetchBackendVehicleChoices → GET /api/trips/{id}/vehicle-choices
 *   changeBackendTripVehicle   → PATCH /api/trips/{id}
 * Mã chuyến trên URL đổi sang mã số của máy chủ qua `resolveBackendTripId`.
 */
import type { VehicleFitIssue } from '@/domain/constraints'
import { configVehicleOf, type BackendVehicleConfig } from '@/features/fleet/fleet-dto'
import { api } from '@/lib/api-client'
import type { VehicleStatus } from '@/lib/mock-db'
import type { VehicleChoice, VehicleChoices } from './trip-vehicle-api'
import { resolveBackendTripId } from './trips-backend-api'

type BackendFitIssue = { code: string; severity: string; params: Record<string, unknown> }

type BackendVehicleChoice = {
  vehicle: BackendVehicleConfig
  /** `AVAILABLE` · `MAINTENANCE` · `RETIRED`. */
  status: string | null
  current: boolean
  busyTripCode: string | null
  selectable: boolean
  issues: BackendFitIssue[]
}

type BackendVehicleChoices = {
  cargo: { count: number; totalKg: number | null; totalCm3: number | null }
  choices: BackendVehicleChoice[]
}

const FIT_CODES = new Set(['CARGO_TOO_LARGE', 'CARGO_VOLUME_EXCEEDED', 'CARGO_WEIGHT_EXCEEDED', 'AXLE_CAPACITY_EXCEEDED'])

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

/** Lý do của máy chủ cùng mã và tham số với `vehicleFit` của domain; mã lạ bỏ qua (`selectable` của máy chủ vẫn quyết định). */
function fitIssueOf(issue: BackendFitIssue): VehicleFitIssue | null {
  if (!FIT_CODES.has(issue.code)) return null
  const p = issue.params
  switch (issue.code) {
    case 'CARGO_TOO_LARGE': {
      const packageIds = Array.isArray(p.packageIds) ? p.packageIds.map(String) : []
      return { code: 'CARGO_TOO_LARGE', severity: 'error', params: { count: num(p.count ?? packageIds.length), packageIds } }
    }
    case 'CARGO_VOLUME_EXCEEDED':
      return { code: 'CARGO_VOLUME_EXCEEDED', severity: 'error', params: { totalCm3: num(p.totalCm3), cargoCm3: num(p.cargoCm3) } }
    case 'CARGO_WEIGHT_EXCEEDED':
      return { code: 'CARGO_WEIGHT_EXCEEDED', severity: 'error', params: { totalKg: num(p.totalKg), maxPayloadKg: num(p.maxPayloadKg), overKg: num(p.overKg) } }
    default:
      return { code: 'AXLE_CAPACITY_EXCEEDED', severity: 'error', params: { totalKg: num(p.totalKg), capacityKg: num(p.capacityKg), overKg: num(p.overKg) } }
  }
}

/** Xe đang chạy chuyến khác là `in_use`; bảo dưỡng và ngừng dùng là `maintenance` — đều không chọn được. */
function statusOf(choice: BackendVehicleChoice): VehicleStatus {
  if (choice.busyTripCode) return 'in_use'
  return choice.status === 'AVAILABLE' || choice.status === null ? 'available' : 'maintenance'
}

function choiceOf(choice: BackendVehicleChoice): VehicleChoice {
  const issues = choice.issues.map(fitIssueOf).filter((issue): issue is VehicleFitIssue => issue !== null)
  return {
    vehicle: configVehicleOf(choice.vehicle),
    status: statusOf(choice),
    current: choice.current,
    fit: { fits: issues.length === 0, issues },
    ...(choice.busyTripCode ? { busyTripId: choice.busyTripCode } : {}),
    selectable: choice.selectable,
  }
}

// GET /api/trips/{id}/vehicle-choices
export async function fetchBackendVehicleChoices(tripCode: string): Promise<VehicleChoices> {
  const tripId = await resolveBackendTripId(tripCode)
  const dto = await api().get<BackendVehicleChoices>(`/api/trips/${encodeURIComponent(tripId)}/vehicle-choices`)
  return {
    cargo: { count: dto.cargo.count, totalKg: num(dto.cargo.totalKg), totalCm3: num(dto.cargo.totalCm3) },
    choices: dto.choices.map(choiceOf),
  }
}

/** Máy chủ kiểm lại xe (sẵn sàng, không chạy chuyến khác, chở được hàng) và đánh dấu mọi phương án của chuyến lỗi thời. */
// PATCH /api/trips/{id}
export async function changeBackendTripVehicle(tripCode: string, vehicleId: string): Promise<void> {
  const tripId = await resolveBackendTripId(tripCode)
  await api().patch<unknown>(`/api/trips/${encodeURIComponent(tripId)}`, { body: { vehicleId: Number(vehicleId) } })
}
