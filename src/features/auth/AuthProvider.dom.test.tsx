import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { signedInAs } from '@/test/signed-in'
import { AuthProvider, useAuth } from './AuthProvider'

/**
 * Đổi người trong cùng tab không được để lại dữ liệu của người trước (FE-0-02): khoá truy vấn của app không mang người dùng hay công
 * ty, nên `AuthProvider` xoá cache Query lúc đăng xuất và lúc đăng nhập. Màn thử đọc `['trips']` như danh sách chuyến, với cùng
 * `staleTime` 30 giây của app — dữ liệu còn "tươi" thì Query không đọc lại kho.
 */
function Screen() {
  const { user, signIn, signOut } = useAuth()
  const trips = useQuery({ queryKey: ['trips'], queryFn: () => getMockDb().listTrips(), enabled: user !== null })
  return (
    <>
      <output aria-label="user">{user?.email ?? 'signed out'}</output>
      <ul aria-label="trips">{trips.data?.map((trip) => <li key={trip.id}>{trip.id}</li>)}</ul>
      <button type="button" onClick={() => void signOut()}>sign out</button>
      <button
        type="button"
        onClick={() => void signIn()}
      >
        sign in at Phuong Nam
      </button>
    </>
  )
}

const SLOW = { timeout: 5000 }
const tripIds = () => within(screen.getByRole('list', { name: 'trips' })).queryAllByRole('listitem').map((item) => item.textContent)

test('signing out and in as someone of another company never shows the trips the previous user had loaded', async () => {
  const user = userEvent.setup()
  signedInAs('dispatcher')
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000, retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Screen />
      </AuthProvider>
    </QueryClientProvider>,
  )
  // Điều phối viên của Long Bình: 15 chuyến của Long Bình, không có chuyến của Phương Nam
  await waitFor(() => expect(tripIds()).toHaveLength(15), SLOW)
  expect(tripIds()).toContain('TRIP-2026-0914')
  expect(tripIds()).not.toContain('TRIP-PN-001')

  await user.click(screen.getByRole('button', { name: 'sign out' }))
  await waitFor(() => expect(screen.getByRole('status', { name: 'user' })).toHaveTextContent('signed out'), SLOW)
  // Màn còn gắn nên Query dựng lại một mục rỗng cho `['trips']`; không mục nào còn giữ dữ liệu của người vừa đăng xuất
  expect(client.getQueryCache().getAll().filter((query) => query.state.data !== undefined)).toStrictEqual([])
  expect(tripIds()).toStrictEqual([])

  await user.click(screen.getByRole('button', { name: 'sign in at Phuong Nam' }))
  await waitFor(() => expect(screen.getByRole('status', { name: 'user' })).toHaveTextContent('dieuphoi@phuongnam.vn'), SLOW)
  // Ngay khi phiên mới có mặt, màn không còn chuyến nào của Long Bình; rồi kho trả đúng hai chuyến của Phương Nam
  expect(tripIds()).toStrictEqual([])
  await waitFor(() => expect(tripIds()).toStrictEqual(['TRIP-PN-001', 'TRIP-PN-002']), SLOW)
})
