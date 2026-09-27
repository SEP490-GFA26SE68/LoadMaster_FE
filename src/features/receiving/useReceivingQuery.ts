import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthProvider'
import { refreshSourcing } from '@/features/packages-source/usePackagesSourceQuery'
import { fetchIncomingShipments, receivePackageByQr } from './receiving-api'

/** Hook Query của màn nhận hàng (LM-104): lô bàn giao cho công ty của người đăng nhập, đọc lại mỗi lần mở. */
export function useIncomingShipmentsQuery() {
  const { user } = useAuth()
  return useQuery({ queryKey: ['receiving', 'incoming', user?.id ?? null], queryFn: fetchIncomingShipments, staleTime: 0 })
}

/**
 * Nhận một kiện bằng mã QR. Lỗi của kho (`QR_UNKNOWN`, `RECEIVING_FORBIDDEN`, `PACKAGE_ALREADY_RECEIVED`) hiện qua `dataErrorMessage`.
 * Xong thì làm mới lô, kiện và đơn hàng (kiện đã nhận mới chọn được cho đơn).
 */
export function useReceivePackageMutation() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (token: string) => receivePackageByQr(token), onSuccess: () => refreshSourcing(client) })
}
