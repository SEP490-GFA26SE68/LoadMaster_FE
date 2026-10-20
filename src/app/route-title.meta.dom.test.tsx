import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, Outlet, RouterProvider, type RouteObject } from 'react-router'
import { afterEach, beforeEach, expect, test } from 'vitest'
import { seo as enSeo } from '@/lib/i18n/en/seo'
import { seo as viSeo } from '@/lib/i18n/vi/seo'
import { Providers } from './providers'
import { useDocumentTitle, useRouteTitle, type RouteHandle } from './route-title'

/**
 * Thẻ meta lúc chạy (`useRouteTitle`): ba trang công khai mang tiêu đề, mô tả của nhánh `seo` theo ngôn ngữ đang chọn và canonical của
 * chính trang (cùng chữ với HTML tĩnh do plugin `seo` ghi lúc build); màn ứng dụng và màn lỗi bỏ canonical, mang `noindex`. Bảng route
 * nhỏ thay cho `App.tsx` để test không phụ thuộc nội dung các trang.
 */
function MetaOutlet() {
  useRouteTitle()
  return <Outlet />
}

function ErrorScreen() {
  useDocumentTitle('Lỗi')
  return null
}

const named = (name: string): RouteHandle => ({ title: () => name })

const routes: RouteObject[] = [
  {
    element: <MetaOutlet />,
    children: [
      { path: '/gioi-thieu', element: <p>landing</p>, handle: named('Giới thiệu') },
      { path: '/bang-gia', element: <p>pricing</p>, handle: named('Bảng giá') },
      { path: '/chuyen', element: <p>trips</p>, handle: named('Chuyến hàng') },
      // Đường dẫn của trang công khai mà route không khai tiêu đề (ví dụ trang chưa có): không coi là trang công khai
      { path: '/chinh-sach-bao-mat', element: <p>privacy</p> },
    ],
  },
  { path: '/loi', element: <ErrorScreen /> },
]

function openAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<Providers><RouterProvider router={router} /></Providers>)
  return router
}

const meta = (name: string) => document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`)?.content ?? null
const canonical = () => document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href ?? null

beforeEach(() => {
  sessionStorage.clear()
  document.head.replaceChildren()
  document.title = ''
})

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

test('the introduction page carries its search title, description and canonical address, and is indexable', async () => {
  const router = openAt('/gioi-thieu')
  await waitFor(() => expect(document.title).toBe(viSeo.pages.landing.title))
  expect(meta('description')).toBe(viSeo.pages.landing.description)
  expect(canonical()).toBe('https://loadmaster.vn/gioi-thieu')
  expect(meta('robots')).toBeNull()

  await router.navigate('/bang-gia')
  await waitFor(() => expect(document.title).toBe(viSeo.pages.pricing.title))
  expect(meta('description')).toBe(viSeo.pages.pricing.description)
  expect(canonical()).toBe('https://loadmaster.vn/bang-gia')
})

test('the description follows the interface language', async () => {
  window.history.replaceState(null, '', '/?lang=en')
  openAt('/bang-gia')
  await waitFor(() => expect(document.title).toBe(enSeo.pages.pricing.title))
  expect(meta('description')).toBe(enSeo.pages.pricing.description)
  expect(document.documentElement).toHaveAttribute('lang', 'en')
})

test('a screen of the application is kept out of search results', async () => {
  const router = openAt('/gioi-thieu')
  await waitFor(() => expect(canonical()).not.toBeNull())

  await router.navigate('/chuyen')
  await waitFor(() => expect(meta('robots')).toBe('noindex'))
  expect(document.title).toBe('Chuyến hàng · LoadMaster')
  expect(canonical()).toBeNull()
  expect(meta('description')).toBe(viSeo.pages.landing.description)
})

test('a public path whose route declares no title, and an error screen, are not indexable', async () => {
  const router = openAt('/chinh-sach-bao-mat')
  await waitFor(() => expect(meta('robots')).toBe('noindex'))
  expect(canonical()).toBeNull()

  await router.navigate('/loi')
  await waitFor(() => expect(document.title).toBe('Lỗi · LoadMaster'))
  expect(meta('robots')).toBe('noindex')
})
