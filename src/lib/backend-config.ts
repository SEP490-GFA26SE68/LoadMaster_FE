/**
 * Cấu hình nối backend thật. Mặc định app chạy hoàn toàn trên kho mẫu (`mock`) — dev, CI và test không cần backend. Đặt
 * `VITE_AUTH_SOURCE=keycloak` ở `.env.local` thì đăng nhập đi qua Keycloak của backend; dữ liệu của các màn vẫn theo `-api.ts` của
 * từng feature (feature nào chưa nối thì vẫn là kho mẫu).
 */
export type AuthSource = 'mock' | 'keycloak'

export type BackendEnv = {
  readonly VITE_AUTH_SOURCE?: string | undefined
  readonly VITE_API_URL?: string | undefined
  readonly VITE_KEYCLOAK_URL?: string | undefined
  readonly VITE_KEYCLOAK_REALM?: string | undefined
  readonly VITE_KEYCLOAK_CLIENT_ID?: string | undefined
}

export type BackendConfig = {
  readonly authSource: AuthSource
  /** Địa chỉ gốc của backend, không có dấu `/` cuối. */
  readonly apiUrl: string
  readonly keycloak: { readonly url: string; readonly realm: string; readonly clientId: string }
}

const AUTH_SOURCES: readonly AuthSource[] = ['mock', 'keycloak']

const trimmed = (value: string | undefined, fallback: string) => (value?.trim() || fallback).replace(/\/+$/, '')

/** Giá trị lạ của `VITE_AUTH_SOURCE` là lỗi ngay lúc mở app, không âm thầm quay về kho mẫu. */
export function resolveBackendConfig(env: BackendEnv): BackendConfig {
  const source = env.VITE_AUTH_SOURCE?.trim().toLowerCase() || 'mock'
  const authSource = AUTH_SOURCES.find((item) => item === source)
  if (authSource === undefined) throw new Error(`VITE_AUTH_SOURCE phải là "mock" hoặc "keycloak", đang là "${env.VITE_AUTH_SOURCE}"`)
  return {
    authSource,
    apiUrl: trimmed(env.VITE_API_URL, 'http://localhost:8080'),
    keycloak: {
      url: trimmed(env.VITE_KEYCLOAK_URL, 'http://localhost:8180'),
      realm: env.VITE_KEYCLOAK_REALM?.trim() || 'loadmaster',
      clientId: env.VITE_KEYCLOAK_CLIENT_ID?.trim() || 'loadmaster-web',
    },
  }
}

export const backendConfig: BackendConfig = resolveBackendConfig(import.meta.env as BackendEnv)
