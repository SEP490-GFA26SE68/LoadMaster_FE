/**
 * Cấu hình nối backend thật. Mặc định app chạy hoàn toàn trên kho mẫu (`mock`) — dev, CI và test không cần backend. Đặt
 * `VITE_AUTH_SOURCE=keycloak` ở `.env.local` thì đăng nhập đi qua Keycloak của backend; dữ liệu của các màn vẫn theo `-api.ts` của
 * từng feature (feature nào chưa nối thì vẫn là kho mẫu). `VITE_API_FEATURES` chọn nhóm chức năng đã nối nào thật sự gọi backend —
 * để tắt riêng một nhóm khi backend của nhóm đó hỏng mà không phải tắt cả đăng nhập.
 */
export type AuthSource = 'mock' | 'keycloak'

/**
 * Nhóm chức năng có `-api.ts` nối được backend. Thêm nhóm mới: thêm tên ở đây, `-api.ts` của nhóm hỏi `usesBackend('<tên>')`.
 * `users` người dùng · `companies` công ty, thông tin công ty · `billing` gói cước, đăng ký, credit, hoá đơn, thanh toán ·
 * `platformOps` hợp đồng, báo cáo nền tảng · `contacts` liên hệ của khách · `support` yêu cầu hỗ trợ · `packages` kho kiện ·
 * `trips` lập chuyến, tuyến · `monitoring` giám sát, bảng điều khiển · `driver` màn tài xế · `warehouse` màn kho
 */
export const BACKEND_FEATURES = [
  'users',
  'companies',
  'billing',
  'platformOps',
  'contacts',
  'support',
  'packages',
  'trips',
  'monitoring',
  'driver',
  'warehouse',
] as const

export type BackendFeature = (typeof BACKEND_FEATURES)[number]

export type BackendEnv = {
  readonly VITE_AUTH_SOURCE?: string | undefined
  readonly VITE_API_URL?: string | undefined
  readonly VITE_API_FEATURES?: string | undefined
  readonly VITE_KEYCLOAK_URL?: string | undefined
  readonly VITE_KEYCLOAK_REALM?: string | undefined
  readonly VITE_KEYCLOAK_CLIENT_ID?: string | undefined
}

export type BackendConfig = {
  readonly authSource: AuthSource
  /** Địa chỉ gốc của backend, không có dấu `/` cuối. */
  readonly apiUrl: string
  /** Nhóm chức năng gọi backend; luôn rỗng khi đăng nhập bằng kho mẫu. */
  readonly features: ReadonlySet<BackendFeature>
  readonly keycloak: { readonly url: string; readonly realm: string; readonly clientId: string }
}

const AUTH_SOURCES: readonly AuthSource[] = ['mock', 'keycloak']

const trimmed = (value: string | undefined, fallback: string) => (value?.trim() || fallback).replace(/\/+$/, '')

/** `all` (hoặc để trống) là mọi nhóm, `none` là không nhóm nào, còn lại là danh sách tên cách nhau bởi dấu phẩy. */
function featuresOf(value: string | undefined): ReadonlySet<BackendFeature> {
  const text = value?.trim() || 'all'
  if (text === 'all') return new Set(BACKEND_FEATURES)
  if (text === 'none') return new Set()
  const names = text.split(',').map((name) => name.trim()).filter((name) => name !== '')
  const unknown = names.filter((name) => !BACKEND_FEATURES.some((feature) => feature === name))
  if (unknown.length > 0) {
    throw new Error(`VITE_API_FEATURES có nhóm không tồn tại: ${unknown.join(', ')} (nhóm hợp lệ: ${BACKEND_FEATURES.join(', ')}, all, none)`)
  }
  return new Set(BACKEND_FEATURES.filter((feature) => names.includes(feature)))
}

/** Giá trị lạ của `VITE_AUTH_SOURCE` hay `VITE_API_FEATURES` là lỗi ngay lúc mở app, không âm thầm quay về kho mẫu. */
export function resolveBackendConfig(env: BackendEnv): BackendConfig {
  const source = env.VITE_AUTH_SOURCE?.trim().toLowerCase() || 'mock'
  const authSource = AUTH_SOURCES.find((item) => item === source)
  if (authSource === undefined) throw new Error(`VITE_AUTH_SOURCE phải là "mock" hoặc "keycloak", đang là "${env.VITE_AUTH_SOURCE}"`)
  const features = featuresOf(env.VITE_API_FEATURES)
  return {
    authSource,
    apiUrl: trimmed(env.VITE_API_URL, 'http://localhost:8080'),
    features: authSource === 'keycloak' ? features : new Set(),
    keycloak: {
      url: trimmed(env.VITE_KEYCLOAK_URL, 'http://localhost:8180'),
      realm: env.VITE_KEYCLOAK_REALM?.trim() || 'loadmaster',
      clientId: env.VITE_KEYCLOAK_CLIENT_ID?.trim() || 'loadmaster-web',
    },
  }
}

export const backendConfig: BackendConfig = resolveBackendConfig(import.meta.env as BackendEnv)

/** `-api.ts` của một nhóm chức năng hỏi hàm này để chọn backend hay kho mẫu. */
export function usesBackend(feature: BackendFeature): boolean {
  return backendConfig.features.has(feature)
}
