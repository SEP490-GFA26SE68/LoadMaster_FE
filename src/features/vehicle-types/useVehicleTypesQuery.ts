import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { VehicleTypeInput } from '@/lib/mock-db'
import {
  deleteVehicleType,
  fetchVehicleAssignmentRows,
  fetchVehicleTypeAssignments,
  fetchVehicleTypes,
  saveVehicleType,
  setVehicleType,
} from './vehicle-types-api'

/** Hook Query của loại xe (LM-104). Khoá riêng `['vehicle-types']` — không dưới `['vehicles', id]` để không va mã xe. */

const KEY = ['vehicle-types'] as const

/** `staleTime: 0`: tên xe và danh sách xe đổi ở màn Đội xe, mở màn là đọc lại. */
export function useVehicleTypesQuery() {
  return useQuery({ queryKey: [...KEY, 'list'], queryFn: fetchVehicleTypes, staleTime: 0 })
}

/** Mọi xe của đội kèm loại đang gắn — bảng "Gắn loại cho xe". */
export function useVehicleAssignmentRowsQuery() {
  return useQuery({ queryKey: [...KEY, 'vehicles'], queryFn: fetchVehicleAssignmentRows, staleTime: 0 })
}

export function useVehicleTypeAssignmentsQuery() {
  return useQuery({ queryKey: [...KEY, 'assignments'], queryFn: fetchVehicleTypeAssignments })
}

export function useSaveVehicleTypeMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ input, id }: { input: VehicleTypeInput; id?: string }) => saveVehicleType(input, id),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}

export function useDeleteVehicleTypeMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (id: string) => deleteVehicleType(id), onSuccess: () => client.invalidateQueries({ queryKey: KEY }) })
}

export function useSetVehicleTypeMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ vehicleId, vehicleTypeId }: { vehicleId: string; vehicleTypeId: string | null }) => setVehicleType(vehicleId, vehicleTypeId),
    onSuccess: () => client.invalidateQueries({ queryKey: KEY }),
  })
}
