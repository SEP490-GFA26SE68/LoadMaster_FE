import { useQuery } from '@tanstack/react-query'
import { fetchSheetSample } from './design-system-api'

/** Dữ liệu mẫu của hai trang tài liệu; component gọi hook, không gọi `design-system-api.ts` (mục 9). */
export function useSheetSampleQuery() {
  return useQuery({ queryKey: ['design-system', 'sample'], queryFn: fetchSheetSample })
}
