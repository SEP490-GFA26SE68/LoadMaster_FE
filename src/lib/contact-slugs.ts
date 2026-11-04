import { CONTACT_REQUEST_TYPES, type ContactRequestType } from '@/lib/mock-db'

/**
 * Loại yêu cầu liên hệ của khách ↔ slug tiếng Việt không dấu trên URL (`?loai=`): form công khai ở trang giới thiệu đọc nó để chọn sẵn
 * loại yêu cầu, màn `/lien-he-khach` dùng làm bộ lọc. Hai nơi một bảng.
 */
export const CONTACT_TYPE_SLUGS = {
  INQUIRY: 'hoi-thong-tin',
  DEMO_REQUEST: 'xem-demo',
  PRICING: 'bao-gia',
  CONTRACT: 'hop-dong',
  OTHER: 'khac',
} as const satisfies Record<ContactRequestType, string>

/** Slug lạ hoặc vắng thì không có loại nào. */
export function contactTypeFromSlug(slug: string | null): ContactRequestType | undefined {
  return CONTACT_REQUEST_TYPES.find((type) => CONTACT_TYPE_SLUGS[type] === slug)
}
