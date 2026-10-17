import { expect, test } from 'vitest'
import { resolveBackendConfig } from './backend-config'

test('with nothing set the app signs in on the sample store and points at the local backend', () => {
  expect(resolveBackendConfig({})).toStrictEqual({
    authSource: 'mock',
    apiUrl: 'http://localhost:8080',
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
    keycloak: { url: 'https://id.example.test', realm: 'lm', clientId: 'web' },
  })
})

test('an unknown sign-in source is an error, not a silent fallback to the sample store', () => {
  expect(() => resolveBackendConfig({ VITE_AUTH_SOURCE: 'oauth' })).toThrow(/VITE_AUTH_SOURCE/)
})
