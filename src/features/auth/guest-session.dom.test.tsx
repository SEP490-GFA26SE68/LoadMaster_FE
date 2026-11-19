import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { signedInAs } from '@/test/signed-in'
import { AuthProvider, useAuth } from './AuthProvider'

/**
 * Khách mở trang công khai (không có phiên lưu ở tab) thì `AuthProvider` không dựng kho mẫu lúc mở trang: dựng kho (seed) là việc nặng
 * nhất lúc tải trang giới thiệu. Có phiên lưu thì kho vẫn được dựng để xác nhận lại tài khoản.
 */
const getMockDb = vi.hoisted(() => vi.fn<typeof import('@/lib/mock-db').getMockDb>())
vi.mock('@/lib/mock-db', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/mock-db')>()
  getMockDb.mockImplementation(actual.getMockDb)
  return { ...actual, getMockDb }
})

function SignedIn() {
  const { user } = useAuth()
  return <p>{user ? user.email : 'khách'}</p>
}

beforeEach(() => {
  sessionStorage.clear()
  getMockDb.mockClear()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

test('a guest opening the site does not build the mock store', () => {
  vi.stubEnv('MODE', 'development')
  render(<AuthProvider source="mock"><SignedIn /></AuthProvider>)
  expect(screen.getByText('khách')).toBeInTheDocument()
  expect(getMockDb).not.toHaveBeenCalled()
})

test('a session kept in the tab is still confirmed by the store', () => {
  vi.stubEnv('MODE', 'development')
  const user = signedInAs('dispatcher')
  render(<AuthProvider source="mock"><SignedIn /></AuthProvider>)
  expect(screen.getByText(user.email)).toBeInTheDocument()
  expect(getMockDb).toHaveBeenCalled()
})

test('a guest clears the session left in a store that is already built (the shared store under Vitest)', () => {
  const store = getMockDb()
  store.restoreSession(signedInAs('dispatcher').id)
  sessionStorage.clear()
  render(<AuthProvider source="mock"><SignedIn /></AuthProvider>)
  expect(screen.getByText('khách')).toBeInTheDocument()
  expect(store.sessionUser()).toBeNull()
})
