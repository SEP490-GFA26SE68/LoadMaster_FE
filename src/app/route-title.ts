import { useEffect } from 'react'
import { useLocation, useMatches, type Params } from 'react-router'
import type { Permission } from '@/features/auth/permissions'
import { useCan } from '@/features/auth/useCan'
import { useT, type TFunction } from '@/lib/i18n'
import { applyDocumentMeta } from '@/lib/seo/document-meta'
import { absoluteUrl } from '@/lib/seo/html-head'
import { SEO_PAGES, seoPageOf, type SeoPage } from '@/lib/seo/pages'

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
 * Ba trang công khai (`SEO_PAGES`) lấy tiêu đề, mô tả từ nhánh `seo` — cùng chữ với HTML tĩnh mà plugin `seo` của `vite.config.ts` ghi —
 * và giữ canonical của chính trang; màn khác mang `noindex` (`applyDocumentMeta`).
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
  // Chỉ route đã khai tiêu đề mới là trang công khai: đường dẫn của trang chưa có route rơi vào màn 404
  const page = !denied && title !== undefined ? seoPageOf(pathname) : null
  const fullTitle = page ? t(`seo.pages.${page}.title`) : documentTitle(denied ? t('titles.forbidden') : title ? title(t, source) : null)
  useEffect(() => {
    document.title = fullTitle
  }, [fullTitle])
  usePageMeta(page, t)
}

/** Đặt thẳng tên màn cho màn nằm ngoài cây route thường (màn lỗi của router) — màn lỗi không lên công cụ tìm kiếm. */
export function useDocumentTitle(name: string | null): void {
  const t = useT()
  useEffect(() => {
    document.title = documentTitle(name)
  }, [name])
  usePageMeta(null, t)
}

/** Mô tả và canonical của trang công khai; màn khác mang mô tả chung (của trang giới thiệu) và `noindex`. */
function usePageMeta(page: SeoPage | null, t: TFunction): void {
  const description = t(`seo.pages.${page ?? 'landing'}.description`)
  const canonical = page ? absoluteUrl(SEO_PAGES[page]) : null
  useEffect(() => {
    applyDocumentMeta({ description, canonical })
  }, [description, canonical])
}
