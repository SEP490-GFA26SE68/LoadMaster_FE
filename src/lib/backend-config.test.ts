import { expect, test } from 'vitest'
import { BACKEND_FEATURES, resolveBackendConfig } from './backend-config'

test('with nothing set the app signs in on the sample store, points at the local backend and calls it for nothing', () => {
  expect(resolveBackendConfig({})).toStrictEqual({
    authSource: 'mock',
    apiUrl: 'http://localhost:8080',
    features: new Set(),
    keycloak: { url: 'http://localhost:8180', realm: 'loadmaster', clientId: 'loadmaster-web' },
  })
})

test('keycloak mode reads the addresses from the environment and drops trailing slashes', () => {
  const config = resolveBackendConfig({
    VITE_AUTH_SOURCE: ' Keycloak ',
    VITE_API_URL: 'https://api.example.test/',
    VITE_KEYCLOAK_URL: 'https://id.example.test//',
    VITE_KEYCLOAK_REALM: 'lm',
    VITE_KEYCLOAK_CLIENT_ID: 'web',
  })
  expect(config).toStrictEqual({
    authSource: 'keycloak',
    apiUrl: 'https://api.example.test',
    features: new Set(BACKEND_FEATURES),
    keycloak: { url: 'https://id.example.test', realm: 'lm', clientId: 'web' },
  })
})

test('an unknown sign-in source is an error, not a silent fallback to the sample store', () => {
  expect(() => resolveBackendConfig({ VITE_AUTH_SOURCE: 'oauth' })).toThrow(/VITE_AUTH_SOURCE/)
})

test('keycloak mode calls the backend for every wired group unless VITE_API_FEATURES narrows it', () => {
  const keycloak = (features: string) => resolveBackendConfig({ VITE_AUTH_SOURCE: 'keycloak', VITE_API_FEATURES: features }).features
  expect(keycloak('all')).toStrictEqual(new Set(BACKEND_FEATURES))
  expect(keycloak('none')).toStrictEqual(new Set())
  expect(keycloak(' users , packages,')).toStrictEqual(new Set(['users', 'packages']))
})

test('the sample store never calls the backend, whatever VITE_API_FEATURES says', () => {
  expect(resolveBackendConfig({ VITE_API_FEATURES: 'users' }).features).toStrictEqual(new Set())
})

test('an unknown feature group is an error that names it', () => {
  expect(() => resolveBackendConfig({ VITE_AUTH_SOURCE: 'keycloak', VITE_API_FEATURES: 'users,orders' })).toThrow(/orders/)
})
