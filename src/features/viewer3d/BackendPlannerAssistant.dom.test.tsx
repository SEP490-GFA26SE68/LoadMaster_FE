import { render, renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { PlannerAssistant } from '@/features/marketing/assistant/PlannerAssistant'
import { viewerContext } from '@/features/marketing/assistant/viewer-bridge'
import { benchmarkScene } from '@/test/scene'
import { useOperations } from './operations/useOperations'
import { useLoadPlanViewer } from './useLoadPlanViewer'
import { usePlannerAssistant } from './usePlannerAssistant'

const auth = vi.hoisted(() => ({
  user: { id: 'US-0002', fullName: 'Nguyễn Văn An', email: 'dieuphoi@longbinh.vn', role: 'dispatcher' as const, status: 'active' as const },
  signOut: () => {},
  refreshUser: () => {},
}))

vi.mock('@/features/auth/AuthProvider', () => ({
  useAuth: () => auth,
  useAuthSafe: () => auth,
}))

const MODEL = benchmarkScene(132)

/** Nhóm `assistant` chưa nối máy chủ (kho mẫu): Planner không có nút "Trợ lý AI" và không đăng ký gì với trợ lý. */
test('no assistant button in the Planner while the assistant group is not on the server', () => {
  const { container } = render(<PlannerAssistant />)
  expect(container).toBeEmptyDOMElement()
})

test('the Planner does not register with the assistant while the group is off', () => {
  renderHook(() => {
    const state = useLoadPlanViewer(MODEL)
    const operations = useOperations(state)
    usePlannerAssistant({ tripCode: 'TRIP-0007', planId: '41', state, operations, editing: false, onOpenPackages: () => {} })
  })
  expect(viewerContext()).toBeNull()
})
