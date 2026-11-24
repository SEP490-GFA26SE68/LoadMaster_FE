import { afterEach, expect, test, vi } from 'vitest'
import { stubBackend } from '@/test/fake-backend'
import { askAssistant } from './assistant-api'

vi.mock('@/lib/backend-config', () => ({
  backendConfig: { authSource: 'mock', apiUrl: 'http://be.test', features: new Set(), keycloak: { url: '', realm: '', clientId: '' } },
  usesBackend: () => false,
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

/**
 * Kho mẫu (nhóm `assistant` chưa nối máy chủ): mọi câu trả lời là câu soạn sẵn, khớp ở trình duyệt — kể cả câu sâu, vì không có mô hình
 * nào để hỏi —, câu xã giao là câu của từ điển như khi nối máy chủ; không gọi mạng, không gửi lượt đếm nào.
 */
test('without the server every question is matched in the browser and nothing is sent', async () => {
  const { calls } = stubBackend({})
  const context = { surface: 'public', locale: 'vi', conversationId: null, guestKey: null } as const

  await expect(askAssistant({ question: 'Giá các gói thế nào?' }, context)).resolves.toStrictEqual({ kind: 'topic', topicId: 'plans', degraded: false, escalatable: false })
  await expect(askAssistant({ question: 'Nếu dùng 2 năm thì giá gói Pro bao nhiêu?' }, context)).resolves.toMatchObject({ kind: 'topic', topicId: 'plans' })
  await expect(askAssistant({ question: 'chào bạn' }, context)).resolves.toStrictEqual({ kind: 'smallTalk', smallTalk: 'GREETING' })
  await expect(askAssistant({ question: 'Viết thơ giúp tôi' }, context)).resolves.toStrictEqual({ kind: 'fallback', degraded: false })
  expect(calls).toHaveLength(0)
})
