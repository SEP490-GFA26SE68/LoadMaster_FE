import { matchRoutes } from 'react-router'
import type { Permission } from '@/features/auth/permissions'
import { routes } from './App'
import { routeHandle } from './route-title'

/**
 * Một đường dẫn trong **bảng route thật** của `App.tsx`: có màn thật không (không rơi vào route bắt mọi đường dẫn lạ) và các quyền
 * `guarded()` đòi trên đường tới màn đó. `role-routes.dom.test.tsx` và liên kết của trợ lý (`assistant-links.ts`) cùng đọc ở đây. Chỉ xét
 * phần đường dẫn: query và neo bị bỏ.
 */
export function routeAccess(path: string): { exists: boolean; permissions: Permission[] } {
  const pathname = path.split(/[?#]/, 1)[0] ?? ''
  const matches = matchRoutes(routes, pathname) ?? []
  const leaf = matches.at(-1)?.route
  return {
    exists: leaf !== undefined && leaf.path !== '*',
    permissions: matches.flatMap(({ route }) => routeHandle(route.handle).permission ?? []),
  }
}

/** Người xem mở được `path`: route có thật và người xem giữ mọi quyền route đòi — không phải màn 404, không phải màn 403. */
export function canOpenRoute(path: string, allowed: (permission: Permission) => boolean): boolean {
  const { exists, permissions } = routeAccess(path)
  return exists && permissions.every(allowed)
}
