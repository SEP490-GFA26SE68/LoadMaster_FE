import { useSearchParams } from 'react-router'
import { LoadingStepPage } from './LoadingStepPage'
import { ServerLoadingSession } from './ServerLoadingSession'
import { ServerWarehouseTripsPage } from './ServerWarehouseTripsPage'
import { useWarehouseCapabilities } from './useServerWarehouseQuery'
import { WarehouseTripsPage } from './WarehouseTripsPage'

/**
 * `/kho` (LM-086): không có `?chuyen` là danh sách chuyến cần xếp — màn chính của nhân viên kho; có `?chuyen=<mã>` là phiên xếp
 * của chuyến đó. `key` theo mã chuyến để đổi chuyến là dựng phiên mới, không mang lớp phủ hay hộp thoại sang. Nhóm `warehouse` nối
 * backend thì cả hai là bản máy chủ.
 */
export function WarehousePage() {
  const [search] = useSearchParams()
  const caps = useWarehouseCapabilities()
  const tripId = search.get('chuyen')
  if (caps.backend) return tripId ? <ServerLoadingSession key={tripId} tripId={tripId} /> : <ServerWarehouseTripsPage />
  return tripId ? <LoadingStepPage key={tripId} tripId={tripId} /> : <WarehouseTripsPage />
}
