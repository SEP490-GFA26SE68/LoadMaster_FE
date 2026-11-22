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

/** Kho mẫu (nhóm `assistant` chưa nối máy chủ): mọi câu trả lời là câu soạn sẵn, khớp ở trình duyệt, không gọi mạng. */
test('without the server every question is matched in the browser and nothing is sent', async () => {
  const { calls } = stubBackend({})
  const context = { surface: 'public', locale: 'vi', conversationId: null, guestKey: null } as const

  await expect(askAssistant({ question: 'Giá các gói thế nào?' }, context)).resolves.toStrictEqual({ kind: 'topic', topicId: 'plans', degraded: false })
  await expect(askAssistant({ question: 'Viết thơ giúp tôi' }, context)).resolves.toStrictEqual({ kind: 'fallback', degraded: false })
  expect(calls).toHaveLength(0)
})
