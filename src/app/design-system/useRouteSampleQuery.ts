import { useQuery } from '@tanstack/react-query'
import { fetchRouteSample } from './design-system-api'

/** Tuyến mẫu của thẻ Bản đồ tuyến ở `/thanh-phan` (FE-4b-07). */
export function useRouteSampleQuery() {
  return useQuery({ queryKey: ['design-system', 'route-sample'], queryFn: fetchRouteSample })
}
