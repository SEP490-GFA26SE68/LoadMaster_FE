import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, matchRoutes, RouterProvider, type RouteObject } from 'react-router'
import { beforeEach, expect, test } from 'vitest'
import { ROLE_HOME } from '@/features/auth/landing'
import { can, type Permission } from '@/features/auth/permissions'
import { SEARCH_GROUPS, searchGroupsFor, searchSources, type SearchSources } from '@/features/search/quick-search'
import { createTranslator } from '@/lib/i18n'
import { titles } from '@/lib/i18n/vi/titles'
import { signedInAs } from '@/test/signed-in'
import { ROLES, type Role } from '@/types/user'
import { routes } from './App'
import { logoPath, NAV_ITEMS, NAV_SCREENS, navItemsFor } from './nav-items'
import { Providers } from './providers'
import { routeHandle } from './route-title'

/**
 * FE-0-04 (D-20, quyết định G1): không mục điều hướng, logo, nút "Về màn chính" hay kết quả tìm nhanh nào dẫn tới màn chưa có hoặc màn
 * vai trò không mở được. Mọi phép kiểm đọc **bảng route thật** của `App.tsx` và ma trận quyền — không chép tay danh sách route — nên bỏ
 * một route hay một quyền mà quên thanh điều hướng, màn chính là test đỏ.
 */

/** Route khớp `path` trong bảng route: có tồn tại không (không rơi vào route bắt mọi đường dẫn lạ) và các quyền `guarded()` đòi. */
function routeAccess(path: string): { exists: boolean; permissions: Permission[] } {
  const matches = matchRoutes(routes, path) ?? []
  const leaf = matches.at(-1)?.route
  return {
    exists: leaf !== undefined && leaf.path !== '*',
    permissions: matches.flatMap(({ route }) => routeHandle(route.handle).permission ?? []),
  }
}

/** Vai trò mở được `path`: route có thật và vai trò giữ mọi quyền route đòi — không phải màn 404, không phải màn 403. */
function canOpen(role: Role, path: string): boolean {
  const { exists, permissions } = routeAccess(path)
  return exists && permissions.every((permission) => can(role, permission))
}

/** Route lá (màn thật) của bảng route, kèm đường dẫn để báo lỗi; route con `index` mang đường dẫn của cha. */
function leafRoutes(list: readonly RouteObject[], parentPath = ''): { path: string; route: RouteObject }[] {
  return list.flatMap((route) => {
    const path = route.path ?? parentPath
    return route.children ? leafRoutes(route.children, path) : [{ path, route }]
  })
}

test('the route table is what these checks think it is: known screens exist, removed and future screens do not', () => {
  expect(['/', '/chuyen', '/chuyen/TRIP-001/phuong-an', '/ho-so', '/kho', '/tai-xe/diem-giao', '/yeu-cau-giao', '/giam-sat'].filter((path) => !routeAccess(path).exists)).toStrictEqual([])
  expect(['/duyet', '/lo-hang', '/nhan-hang', '/nen-tang/cong-ty', '/nen-tang/goi', '/ho-tro'].filter((path) => routeAccess(path).exists))
    .toStrictEqual([])
  expect(routeAccess('/chuyen/moi').permissions).toStrictEqual(['trips.edit'])
  // Yêu cầu giao thay Đơn hàng (FE-4b-02): đường dẫn cũ chuyển hướng, cùng nhóm quyền với màn mới
  expect(routeAccess('/yeu-cau-giao').permissions).toStrictEqual(['requirements.view'])
  expect(routeAccess('/don-hang').permissions).toStrictEqual(['requirements.view'])
  // Giám sát (FE-6-10): điều phối viên và quản lý công ty
  expect(routeAccess('/giam-sat').permissions).toStrictEqual(['monitoring.view'])
  expect(routeAccess('/ho-so').permissions).toStrictEqual([])
})

test.each(ROLES)('%s: the home screen is a route the role may open', (role) => {
  expect(canOpen(role, ROLE_HOME[role]), ROLE_HOME[role]).toBe(true)
  expect(canOpen(role, logoPath(role)), `logo → ${logoPath(role)}`).toBe(true)
})

test.each(ROLES)('%s: every nav item points to an existing route the role may open, and none is silently dropped', (role) => {
  const items = navItemsFor(role)
  expect(items.filter((item) => !canOpen(role, item.to)).map((item) => item.to)).toStrictEqual([])
  // Danh sách của vai trò không liệt kê màn vai trò không có quyền: thứ khai là thứ hiện
  expect(items.map((item) => item.to)).toStrictEqual(NAV_ITEMS[role].map((id) => NAV_SCREENS[id].to))
  // Màn chính đứng đầu thanh của vai trò có mục
  if (items.length > 0) expect(items[0]?.to).toBe(ROLE_HOME[role])
})

test('every nav screen names exactly the permission its route is guarded by, and is used by some role', () => {
  const listed = new Set(ROLES.flatMap((role) => NAV_ITEMS[role]))
  for (const [id, screen] of Object.entries(NAV_SCREENS)) {
    expect(routeAccess(screen.to), id).toStrictEqual({ exists: true, permissions: [screen.permission] })
    expect(listed.has(id as keyof typeof NAV_SCREENS), `${id} is in no role's list`).toBe(true)
  }
})

test.each(ROLES)('%s: every quick-search group opens a screen the role may open', (role) => {
  const sources: SearchSources = {
    trips: [{ id: 'X-1', name: 'x', stops: [], packageIds: ['X-1'] }],
    vehicles: [{ id: 'X-1', name: 'x' }],
    users: [{ id: 'X-1', fullName: 'x', email: 'x', role: 'driver' }],
    requirements: [{ id: 'X-1', destinationName: 'x', address: 'x' }],
    pool: [{ id: 'X-1', qrToken: 'x', typeName: 'x' }],
    packageTypes: [{ id: 'X-1', name: 'x' }],
  }
  const groups = searchGroupsFor((permission) => can(role, permission))
  const results = searchSources(sources, 'x-1', groups)
  // Nguồn mẫu khớp mọi nhóm: nhóm nào vai trò được tìm cũng có một kết quả để kiểm đích
  expect(results.map((entry) => entry.group)).toStrictEqual(groups)
  expect(results.flatMap((entry) => entry.results).filter((result) => !canOpen(role, result.href)).map((result) => result.href)).toStrictEqual([])
})

test('every quick-search group is found by at least one role', () => {
  const found = new Set(ROLES.flatMap((role) => searchGroupsFor((permission) => can(role, permission))))
  expect(SEARCH_GROUPS.filter((group) => !found.has(group))).toStrictEqual([])
})

test('every screen names its tab, and the dictionary has no title of a screen that is gone', () => {
  const used = new Set<string>()
  const t = new Proxy(createTranslator('vi'), {
    apply(target, self, args: [string, ...unknown[]]) {
      used.add(args[0])
      return Reflect.apply(target, self, args) as string
    },
  })
  // Route chuyển hướng (`/tai-xe/*`) và route bắt đường dẫn lạ không phải màn: 404 tự đặt tiêu đề (`useDocumentTitle`)
  const screens = leafRoutes(routes).filter(({ path }) => !path.endsWith('*'))
  expect(screens.filter(({ route }) => routeHandle(route.handle).title === undefined).map(({ path }) => path)).toStrictEqual([])
  for (const { route } of screens) {
    // Màn có mã trên truy vấn (`?chuyen=`) có hai tên: kèm mã và không kèm mã
    for (const search of ['', 'chuyen=TRIP-001']) routeHandle(route.handle).title?.(t, { params: {}, search: new URLSearchParams(search) })
  }
  // Ba tên không thuộc route nào: màn 403 (`useRouteTitle`), màn 404 và màn lỗi (`NotFoundPage`)
  const outsideRoutes = ['titles.forbidden', 'titles.notFound', 'titles.error']
  expect(Object.keys(titles).map((key) => `titles.${key}`).filter((key) => !used.has(key) && !outsideRoutes.includes(key))).toStrictEqual([])
})

/** Đường dẫn vai trò không mở được: màn vận hành với vai trò nền tảng và quản trị, màn người dùng với vai trò còn lại. */
const forbiddenPathOf = (role: Role) => (can(role, 'users.manage') ? '/chuyen' : '/nguoi-dung')

function openAt(path: string, role: Role) {
  signedInAs(role)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<Providers><RouterProvider router={router} /></Providers>)
  return router
}

beforeEach(() => {
  sessionStorage.clear()
})

const SLOW = { timeout: 8000 }

/** G1: nút "Về màn chính" của màn 404 và 403 mở màn chính của vai trò — với cả tám vai trò, kể cả hai vai trò chưa có màn riêng. */
test.each(ROLES)('%s: the 404 and 403 screens lead back to the home screen of the role', async (role) => {
  expect(canOpen(role, forbiddenPathOf(role))).toBe(false)
  const router = openAt('/khong-co-trang-nay', role)
  await screen.findByRole('heading', { name: 'Không tìm thấy trang' }, SLOW)
  expect(screen.getByRole('link', { name: 'Về màn chính' })).toHaveAttribute('href', ROLE_HOME[role])

  await router.navigate(forbiddenPathOf(role))
  await screen.findByRole('heading', { name: 'Không có quyền truy cập' }, SLOW)
  expect(screen.getByRole('link', { name: 'Về màn chính' })).toHaveAttribute('href', ROLE_HOME[role])
})

test('customer support, who has no screen of its own yet, gets from a 404 back to a real screen', async () => {
  const user = userEvent.setup()
  const router = openAt('/ho-tro', 'systemSupporter')
  await screen.findByRole('heading', { name: 'Không tìm thấy trang' }, SLOW)
  await user.click(screen.getByRole('link', { name: 'Về màn chính' }))
  expect(await screen.findByRole('heading', { level: 1, name: 'Hồ sơ cá nhân' }, SLOW)).toBeInTheDocument()
  expect(router.state.location.pathname).toBe('/ho-so')
  await waitFor(() => expect(document.title).toBe('Hồ sơ cá nhân · LoadMaster'))
  // Thanh điều hướng không có khay mục rỗng; logo cũng về hồ sơ
  expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'LoadMaster — về màn chính' })).toHaveAttribute('href', '/ho-so')
})
