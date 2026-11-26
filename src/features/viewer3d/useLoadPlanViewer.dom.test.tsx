import { act, renderHook } from '@testing-library/react'
import { expect, test } from 'vitest'
import { benchmarkScene } from '@/test/scene'
import type { ViewerSceneModel } from './scene-input'
import { useLoadPlanViewer } from './useLoadPlanViewer'

const withLength = (model: ViewerSceneModel, innerLengthCm: number): ViewerSceneModel => ({ ...model, vehicle: { ...model.vehicle, innerLengthCm } })

test('lát cắt về trọn lòng thùng khi đổi xe giữa phiên; cùng xe thì giữ lát cắt người dùng đặt', () => {
  const model = benchmarkScene(132)
  const full = model.vehicle.innerLengthCm
  const { result, rerender } = renderHook(({ scene }) => useLoadPlanViewer(scene), { initialProps: { scene: model } })
  expect(result.current.sliceCm).toBe(full)
  act(() => result.current.setSliceCm(200))
  expect(result.current.sliceCm).toBe(200)
  rerender({ scene: { ...model } })
  expect(result.current.sliceCm).toBe(200)
  rerender({ scene: withLength(model, 420) })
  expect(result.current.sliceCm).toBe(420)
  act(() => result.current.setSliceCm(150))
  expect(result.current.sliceCm).toBe(150)
})
