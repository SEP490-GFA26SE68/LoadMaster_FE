import { render, waitFor } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import type { SeoPage } from '@/lib/seo/site-files'
import { signedInAs } from '@/test/signed-in'
import type { Role } from '@/types/user'
import { routes } from './App'
import { Providers } from './providers'
import { useDocumentTitle } from './route-title'

/**
 * Thẻ cho công cụ tìm kiếm đi cùng tiêu đề tab: chỉ trang công khai trong `SEO_PAGES` được lập chỉ mục và có mô tả riêng; mọi màn khác —
 * đăng nhập, trong ứng dụng, 403, 404 — mang `noindex`. Test chạy không có `VITE_SITE_URL` nên không màn nào có canonical hay `og:url`.
 */
window.matchMedia ??= (query: string) => ({
  matches: false, media: query, onchange: null,
  addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
})

const meta = (selector: string) => document.head.querySelector(selector)?.getAttribute('content') ?? null

function openAt(path: string, role?: Role) {
  if (role) signedInAs(role)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<Providers><RouterProvider router={router} /></Providers>)
  return router
}

beforeEach(() => {
  sessionStorage.clear()
  document.title = ''
  document.head.querySelectorAll('meta, link[rel="canonical"], script[data-seo]').forEach((node) => node.remove())
})

test('a public page is indexed and describes itself; moving to the sign-in screen turns indexing off', async () => {
  const router = openAt('/bang-gia')
  await waitFor(() => expect(meta('meta[name="robots"]')).toBe('index, follow'))
  expect(meta('meta[name="description"]')).toBe('Các gói cước LoadMaster đang bán: giá mỗi tháng, credit mỗi tháng và hạng tối ưu của từng gói.')
  expect(meta('meta[property="og:title"]')).toBe('Bảng giá · LoadMaster')
  expect(meta('meta[property="og:description"]')).toBe(meta('meta[name="description"]'))
  expect(meta('meta[property="og:locale"]')).toBe('vi_VN')
  // Chưa khai VITE_SITE_URL: không bịa tên miền
  expect(document.head.querySelector('link[rel="canonical"]')).toBeNull()
  expect(meta('meta[property="og:url"]')).toBeNull()

  await router.navigate('/dang-nhap')
  await waitFor(() => expect(meta('meta[name="robots"]')).toBe('noindex'))
  expect(meta('meta[property="og:title"]')).toBe('Đăng nhập · LoadMaster')
})

test('both legal pages are indexed', async () => {
  const router = openAt('/chinh-sach-bao-mat')
  await waitFor(() => expect(document.title).toBe('Chính sách bảo mật · LoadMaster'))
  expect(meta('meta[name="robots"]')).toBe('index, follow')

  await router.navigate('/dieu-khoan-su-dung')
  await waitFor(() => expect(document.title).toBe('Điều khoản sử dụng · LoadMaster'))
  expect(meta('meta[name="robots"]')).toBe('index, follow')
  expect(meta('meta[name="description"]')).toMatch(/^Điều khoản sử dụng LoadMaster/)
})

test('screens inside the app, the 403 screen and the 404 screen are never indexed', async () => {
  const router = openAt('/chuyen', 'dispatcher')
  await waitFor(() => expect(document.title).toBe('Chuyến hàng · LoadMaster'))
  expect(meta('meta[name="robots"]')).toBe('noindex')

  await router.navigate('/nguoi-dung')
  await waitFor(() => expect(document.title).toBe('Không có quyền truy cập · LoadMaster'))
  expect(meta('meta[name="robots"]')).toBe('noindex')

  await router.navigate('/khong-co-trang-nay')
  await waitFor(() => expect(document.title).toBe('Không tìm thấy trang · LoadMaster'))
  expect(meta('meta[name="robots"]')).toBe('noindex')
})

function Titled({ page }: { page: SeoPage | null }) {
  useDocumentTitle('Giới thiệu', page)
  return null
}

test('the landing page carries the application block, in the chosen language; other screens carry none', async () => {
  sessionStorage.setItem('loadmaster.ngon-ngu', 'en')
  const { rerender } = render(<I18nProvider><Titled page="landing" /></I18nProvider>)
  await waitFor(() => expect(document.head.querySelector('script[data-seo="page"]')).not.toBeNull())
  const block = JSON.parse(document.head.querySelector('script[data-seo="page"]')?.textContent ?? '{}')
  expect(block).toMatchObject({ '@type': 'SoftwareApplication', name: 'LoadMaster', applicationCategory: 'BusinessApplication' })
  expect(block.description).toBe(meta('meta[name="description"]'))
  expect(block).not.toHaveProperty('url')
  expect(meta('meta[property="og:locale"]')).toBe('en_US')
  expect(document.head.querySelectorAll('script[data-seo="page"]')).toHaveLength(1)

  rerender(<I18nProvider><Titled page={null} /></I18nProvider>)
  await waitFor(() => expect(document.head.querySelector('script[data-seo="page"]')).toBeNull())
  expect(meta('meta[name="robots"]')).toBe('noindex')
})
