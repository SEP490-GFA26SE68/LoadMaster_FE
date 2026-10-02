import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { searchAddress } from './places-api'

/**
 * Gợi ý địa danh theo từ khoá đang gõ (FE-4b-03). Từ khoá rỗng không gọi. Giữ kết quả cũ trong lúc tìm từ khoá mới để danh sách không
 * chớp tắt theo từng phím.
 */
export function usePlaceSearchQuery(query: string) {
  const wanted = query.trim()
  return useQuery({
    queryKey: ['places', 'search', wanted],
    queryFn: () => searchAddress(wanted),
    enabled: wanted !== '',
    placeholderData: keepPreviousData,
  })
}
