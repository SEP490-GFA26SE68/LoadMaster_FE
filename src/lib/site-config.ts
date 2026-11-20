import { resolveSiteUrl } from './seo/site-files'

/**
 * Địa chỉ gốc của trang công khai khi bản cài đặt khai `VITE_SITE_URL` (mẫu ở `.env.example`), không thì `null`. Code không viết tên
 * miền nào: có giá trị thì canonical, `og:url` và JSON-LD dùng địa chỉ tuyệt đối, không có thì các thẻ đó không được vẽ.
 */
export const SITE_URL: string | null = resolveSiteUrl((import.meta.env as { readonly VITE_SITE_URL?: string }).VITE_SITE_URL)
