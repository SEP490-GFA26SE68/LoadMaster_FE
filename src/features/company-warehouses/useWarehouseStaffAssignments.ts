import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usesBackend } from '@/lib/backend-config'
import { assignWarehouseStaff, getAssignmentHistory, getStaffAssignments, getWarehouseStaff, revokeWarehouseStaff } from './warehouse-staff-api'

export function useWarehouseStaffAssignments(scope: string, warehouse: number, open: boolean) {
  const client = useQueryClient()
  const key = ['warehouse-staff', scope, warehouse] as const
  const enabled = open && usesBackend('companies')
  const staff = useQuery({ queryKey: ['warehouse-staff-options', scope], queryFn: getWarehouseStaff, enabled })
  const assignments = useQuery({ queryKey: [...key, 'current'], queryFn: () => getStaffAssignments(warehouse), enabled })
  const history = useInfiniteQuery({
    queryKey: [...key, 'history'], queryFn: ({ pageParam }) => getAssignmentHistory(warehouse, pageParam),
    initialPageParam: 0, getNextPageParam: (last, pages) => last.length === 50 ? pages.length : undefined, enabled,
  })
  async function refresh() {
    await Promise.all([
      client.invalidateQueries({ queryKey: key }),
      client.invalidateQueries({ queryKey: ['warehouse-staff-options', scope] }),
    ])
  }
  const mutation = useMutation({
    mutationFn: ({ userId, active }: { userId: number; active: boolean }) => active ? assignWarehouseStaff(warehouse, userId) : revokeWarehouseStaff(warehouse, userId),
    // Never invent current state after timeout/conflict, or optimistically claim a grant/revoke.
    onSettled: refresh,
  })
  return { staff, assignments, history, mutation, refresh }
}
