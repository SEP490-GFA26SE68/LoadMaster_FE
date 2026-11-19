import { render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { installFakeIntersectionObserver, type FakeIntersectionObserverControl } from '@/test/intersection-observer'

/**
 * Cổng của khung 3D trang giới thiệu (`useStageGate`): chỉ mở khi khung đã tới gần khung nhìn. jsdom không có WebGL nên test dựng lớp
 * `WebGLRenderingContext` và `getContext` giả trước khi nạp module (cổng đọc lớp đó một lần lúc nạp).
 */
let io: FakeIntersectionObserverControl | undefined

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('WebGLRenderingContext', class {})
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => ({ getExtension: () => ({ loseContext: () => {} }) }) as unknown as RenderingContext,
  )
})
afterEach(() => {
  io?.restore()
  io = undefined
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function renderGate() {
  const { useStageGate } = await import('./useStageGate')
  function Probe() {
    const [box, setBox] = useState<HTMLElement | null>(null)
    const gate = useStageGate(box)
    return <div ref={setBox} role="status">{gate}</div>
  }
  render(<Probe />)
  return () => screen.getByRole('status')
}

test('waits while the stage is far from the viewport, then opens once it comes within 250 px', async () => {
  io = installFakeIntersectionObserver()
  const gate = await renderGate()
  expect(gate()).toHaveTextContent('wait')
  const observer = io.instances.at(-1)
  expect(observer?.rootMargin).toBe('250px 0px')

  io.trigger(gate(), { isIntersecting: false })
  await new Promise((resolve) => setTimeout(resolve, 400))
  expect(gate()).toHaveTextContent('wait')

  io.trigger(gate())
  await waitFor(() => expect(gate()).toHaveTextContent('go'))
  // Mở rồi thì thôi theo dõi
  expect(observer?.targets.size).toBe(0)
})

test('without IntersectionObserver the stage counts as near and opens when the browser is idle', async () => {
  const gate = await renderGate()
  await waitFor(() => expect(gate()).toHaveTextContent('go'))
})

test('a context that cannot be created keeps the illustration', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  const gate = await renderGate()
  await waitFor(() => expect(gate()).toHaveTextContent('off'))
})

test('data saver keeps the illustration without loading anything, even in view', async () => {
  vi.stubGlobal('navigator', Object.assign(Object.create(navigator) as Navigator, { connection: { saveData: true } }))
  io = installFakeIntersectionObserver()
  const gate = await renderGate()
  expect(gate()).toHaveTextContent('off')
  expect(io.instances).toHaveLength(0)
})
