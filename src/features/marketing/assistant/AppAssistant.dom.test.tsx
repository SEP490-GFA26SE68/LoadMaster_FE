import { render } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { AppAssistant } from './AppAssistant'

const auth = vi.hoisted(() => ({
  user: { id: 'US-0002', fullName: 'Nguyễn Văn An', email: 'dieuphoi@longbinh.vn', role: 'dispatcher' as const, status: 'active' as const },
  signOut: () => {},
  refreshUser: () => {},
}))

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => auth,
  useAuthSafe: () => auth,
}))

/** Kho mẫu (nhóm `assistant` chưa nối máy chủ): khung ứng dụng không có nút trợ lý, kể cả với người dùng đang đăng nhập bình thường. */
test('no assistant button in the app while the assistant group is not on the server', () => {
  const { container } = render(<AppAssistant />)
  expect(container).toBeEmptyDOMElement()
})
