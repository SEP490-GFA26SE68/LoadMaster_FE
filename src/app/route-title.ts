import { useEffect } from 'react'
import { useLocation, useMatches, type Params } from 'react-router'
import type { Permission } from '@/features/auth/permissions'
import { useCan } from '@/features/auth/useCan'
import { useLocale, useT, type TFunction } from '@/lib/i18n'
import { applyPageMeta } from '@/lib/seo/document-meta'
import { pageMeta } from '@/lib/seo/page-meta'
import { SEO_PAGES, seoPageOf, type SeoPage } from '@/lib/seo/site-files'
import { softwareApplicationLd } from '@/lib/seo/structured-data'
import { SITE_URL } from '@/lib/site-config'

/** Nơi lấy mã cho tiêu đề: tham số đường dẫn (`:tripId`) và tham số truy vấn (`?chuyen=`). */
export type TitleSource = { readonly params: Readonly<Params>; readonly search: URLSearchParams }

/**
 * `handle` của route (LM-100). `title` là tên màn trên tab, dịch theo ngôn ngữ đang chọn; `permission` do `guarded()` gắn
 * cho nhóm route cần quyền — thiếu quyền thì tab mang tên màn 403 thay cho tên màn đích.
 */
export type RouteHandle = {
  readonly title?: (t: TFunction, source: TitleSource) => string
  readonly permission?: Permission
}

const APP_NAME = 'LoadMaster'

/** "<tên màn> · LoadMaster"; chưa có tên màn thì chỉ tên ứng dụng. */
export function documentTitle(name: string | null): string {
  return name ? `${name} · ${APP_NAME}` : APP_NAME
}

/** `handle` của một route đọc theo kiểu `RouteHandle`; route không khai `handle` thì rỗng. */
export function routeHandle(handle: unknown): RouteHandle {
  return typeof handle === 'object' && handle !== null ? handle : {}
}

/**
 * Tiêu đề tab của route đang mở: `title` của route sâu nhất có khai, tham số lấy từ route lá và URL. Gọi một lần ở layout của
 * mỗi nhóm route (`RouteOutlet` trong `App.tsx`), không gọi ở từng trang. Đổi ngôn ngữ hay đổi mã trên URL thì tiêu đề đổi theo.
 *
 * Cùng lúc đặt thẻ của màn cho công cụ tìm kiếm và ô xem trước khi chia sẻ (`usePageMeta`): trang công khai trong `SEO_PAGES` — route
 * đã khai tiêu đề và mở được — mang mô tả riêng, canonical và được lập chỉ mục; mọi màn khác mang `noindex`.
 */
export function useRouteTitle(): void {
  const t = useT()
  const can = useCan()
  const matches = useMatches()
  const { pathname, search } = useLocation()
  const handles = matches.map((match) => routeHandle(match.handle))
  const denied = handles.some(({ permission }) => permission !== undefined && !can(permission))
  const title = handles.findLast((handle) => handle.title !== undefined)?.title
  const source = { params: matches.at(-1)?.params ?? {}, search: new URLSearchParams(search) }
  // Đường dẫn của trang công khai chưa có route rơi vào màn 404 (`useDocumentTitle`), không qua đây
  const page = !denied && title !== undefined ? seoPageOf(pathname) : null
  useDocumentTitle(denied ? t('titles.forbidden') : title ? title(t, source) : null, page)
}

/** Đặt thẳng tên màn cho màn nằm ngoài cây route thường (màn lỗi của router). Màn lỗi không truyền `page` nên mang `noindex`. */
export function useDocumentTitle(name: string | null, page: SeoPage | null = null): void {
  const title = documentTitle(name)
  useEffect(() => {
    document.title = title
  }, [title])
  usePageMeta(page, title)
}

/**
 * Thẻ mô tả, `robots`, canonical, Open Graph và JSON-LD của màn đang mở, theo ngôn ngữ đang chọn. Trang giới thiệu mang thêm khối
 * `SoftwareApplication`; khối `FAQPage` do chính phần Hỏi đáp vẽ (`marketing/faq/FaqStructuredData`).
 */
function usePageMeta(page: SeoPage | null, title: string): void {
  const t = useT()
  const { locale } = useLocale()
  const description = t(`seo.pages.${page ?? 'landing'}`)
  useEffect(() => {
    const structuredData =
      page === 'landing'
        ? softwareApplicationLd({ name: APP_NAME, description, pagePath: SEO_PAGES.landing, siteUrl: SITE_URL, languages: ['vi', 'en'] })
        : null
    applyPageMeta(pageMeta({ page, title, description, locale, siteUrl: SITE_URL, structuredData }))
  }, [page, title, description, locale])
}
