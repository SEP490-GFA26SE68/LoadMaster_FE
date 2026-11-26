import { act, renderHook } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { useObservedSizes } from './useObservedSizes'

type Callback = (entries: { target: Element; borderBoxSize: { inlineSize: number; blockSize: number }[] }[]) => void

afterEach(() => { vi.unstubAllGlobals() })

test('kích thước lấy từ ResizeObserver, không đọc layout; đổi kích thước thì báo để vẽ lại', () => {
  const observers: { callback: Callback; observed: Set<Element> }[] = []
  vi.stubGlobal('ResizeObserver', class {
    observed = new Set<Element>()
    constructor(callback: Callback) { observers.push({ callback, observed: this.observed }) }
    observe(element: Element) { this.observed.add(element) }
    unobserve(element: Element) { this.observed.delete(element) }
    disconnect() { this.observed.clear() }
  })
  const onResize = vi.fn()
  const { result } = renderHook(() => useObservedSizes(onResize))
  const element = document.createElement('span')
  const offsetHeight = vi.spyOn(element, 'offsetHeight', 'get')
  act(() => result.current.track(element))
  expect(observers[0]!.observed.has(element)).toBe(true)
  expect(result.current.sizeOf(element)).toBeNull()

  act(() => observers[0]!.callback([{ target: element, borderBoxSize: [{ inlineSize: 120, blockSize: 28 }] }]))
  expect(result.current.sizeOf(element)).toEqual({ width: 120, height: 28 })
  expect(onResize).toHaveBeenCalledTimes(1)
  expect(offsetHeight).not.toHaveBeenCalled()

  act(() => result.current.track(null, element))
  expect(observers[0]!.observed.has(element)).toBe(false)
  expect(result.current.sizeOf(element)).toBeNull()
})

test('không có ResizeObserver thì đọc thẳng kích thước của phần tử', () => {
  vi.stubGlobal('ResizeObserver', undefined)
  const { result } = renderHook(() => useObservedSizes(() => {}))
  const element = document.createElement('span')
  vi.spyOn(element, 'offsetWidth', 'get').mockReturnValue(40)
  vi.spyOn(element, 'offsetHeight', 'get').mockReturnValue(12)
  expect(result.current.sizeOf(element)).toEqual({ width: 40, height: 12 })
})
