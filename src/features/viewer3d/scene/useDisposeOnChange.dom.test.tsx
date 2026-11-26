import { renderHook } from '@testing-library/react'
import { expect, test, vi } from 'vitest'
import { useDisposeOnChange } from './useDisposeOnChange'

const resource = () => ({ dispose: vi.fn() })

/** Cách `TruckCab` giải phóng geometry: mỗi geometry một lần gọi, chỉ cái bị thay mới bị giải phóng. */
function useTruckGeometries(detail: { dispose(): void }, wheel: { dispose(): void }, body: { dispose(): void }) {
  useDisposeOnChange(detail)
  useDisposeOnChange(wheel)
  useDisposeOnChange(body)
}

test('đổi một geometry chỉ giải phóng geometry cũ đó; gỡ component giải phóng những cái còn lại', () => {
  const detail = resource()
  const wheel = resource()
  const body = resource()
  const { rerender, unmount } = renderHook(({ d }) => useTruckGeometries(d, wheel, body), { initialProps: { d: detail } })
  const nextDetail = resource()
  rerender({ d: nextDetail })
  expect(detail.dispose).toHaveBeenCalledOnce()
  expect(wheel.dispose).not.toHaveBeenCalled()
  expect(body.dispose).not.toHaveBeenCalled()
  unmount()
  expect(nextDetail.dispose).toHaveBeenCalledOnce()
  expect(wheel.dispose).toHaveBeenCalledOnce()
  expect(body.dispose).toHaveBeenCalledOnce()
})
