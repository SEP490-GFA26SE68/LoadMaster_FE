import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import type { VehicleConfig } from '@/domain/models'
import type { LoadPlan, LoadPlacement } from '@/features/optimization/load-plan-dto'
import { I18nProvider } from '@/lib/i18n'
import { backendPlanScene } from '../backend-plan-scene'
import { useLoadPlanViewer } from '../useLoadPlanViewer'
import { useManualEditor } from './useManualEditor'

const engineBuilds = vi.hoisted(() => ({ count: 0 }))
vi.mock('@/domain/constraints', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/domain/constraints')>()
  return {
    ...actual,
    createConstraintEngine: (...args: Parameters<typeof actual.createConstraintEngine>) => {
      engineBuilds.count += 1
      return actual.createConstraintEngine(...args)
    },
  }
})

/**
 * Constraint engine của editor dựng lười (đo 1.000 kiện: ~220 ms mỗi lần dựng): mở Planner ở chế độ Xem không dựng engine nào, vào
 * Chỉnh sửa mới dựng — đúng một lần cho một snapshot, ra vào chế độ nhiều lần cũng vậy.
 */
const VEHICLE: VehicleConfig = {
  id: '7', name: 'Xe tải 1,5 tấn', innerLengthCm: 400, innerWidthCm: 200, innerHeightCm: 200, maxPayloadKg: 1500,
  doorWidthCm: 200, doorHeightCm: 200, doorPosition: 'REAR', clearanceCm: 0, obstacles: [],
}

const placement = (id: string, code: string, x: number): LoadPlacement => ({
  id, packageId: `P${id}`, code, weightKg: 20, x, y: 0, z: 0, lengthCm: 100, widthCm: 50, heightCm: 40,
  rotationType: 0, step: Number(id) - 10, pinned: false, stopId: '91', stopSequence: 1,
})

const PLAN: LoadPlan = {
  id: '501', tripId: '42', jobId: 'job-1', objective: 'MAX_VOLUME', label: 'A', algorithmName: 'EP_DBLF', runAlgorithm: 'EP_DBLF', computationMs: null,
  name: null, volumePercent: null, payloadPercent: null, approved: true, approvedByName: null, centerOfGravityCm: null,
  frontAxleLoadKg: null, rearAxleLoadKg: null, rehandlingCount: null, manuallyEdited: false, stale: false,
  placements: [placement('11', 'PK-1', 0), placement('12', 'PK-2', 100)], unplaced: [], stopZones: null,
}

const MODEL = backendPlanScene({ tripCode: 'TRIP-1', plan: PLAN, vehicle: VEHICLE, stops: [{ id: '91', sequence: 1, name: 'Cửa hàng Thủ Đức', deadline: null }] })

function wrapper({ children }: { children: ReactNode }) {
  return <I18nProvider>{children}</I18nProvider>
}

test('chế độ Xem không dựng constraint engine; vào Chỉnh sửa dựng đúng một lần cho snapshot', () => {
  engineBuilds.count = 0
  const { result } = renderHook(() => {
    const state = useLoadPlanViewer(MODEL, { initialSelectedId: MODEL.placements[0]?.id })
    return useManualEditor(state)
  }, { wrapper })

  expect(result.current.mode).toBe('view')
  expect(result.current.validation).toBeNull()
  expect(engineBuilds.count).toBe(0)

  act(() => result.current.setMode('edit'))
  expect(result.current.validation).toMatchObject({ valid: true })
  expect(engineBuilds.count).toBe(1)

  act(() => result.current.setMode('view'))
  act(() => result.current.setMode('edit'))
  expect(engineBuilds.count).toBe(1)
})
