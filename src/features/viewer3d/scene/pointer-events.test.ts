import { describe, expect, test } from 'vitest'
import { createHoverGate } from './pointer-events'

/** Bộ hẹn khung giả: `frame()` chạy các callback đang chờ như một lần `requestAnimationFrame`. */
function fakeFrames() {
  let next = 1
  const queue = new Map<number, () => void>()
  return {
    request: (callback: () => void) => { const id = next++; queue.set(id, callback); return id },
    cancel: (id: number) => { queue.delete(id) },
    frame() { const due = [...queue.values()]; queue.clear(); due.forEach((callback) => callback()) },
    get waiting() { return queue.size },
  }
}

const move = (x: number, buttons = 0) => ({ type: 'pointermove', x, buttons }) as unknown as Event

describe('hover gate', () => {
  test('the first move of a frame is probed at once; later ones in the same frame collapse into the newest, probed next frame', () => {
    const frames = fakeFrames()
    const probed: Event[] = []
    const gate = createHoverGate((event) => probed.push(event), frames)
    const a = move(1), b = move(2), c = move(3)
    gate.move(a); gate.move(b); gate.move(c)
    expect(probed).toEqual([a])
    frames.frame()
    expect(probed).toEqual([a, c])
    frames.frame()
    expect(probed).toEqual([a, c])
    expect(frames.waiting).toBe(0)
  })

  test('one move per frame (the browser already aligns pointermove) is probed without delay', () => {
    const frames = fakeFrames()
    const probed: Event[] = []
    const gate = createHoverGate((event) => probed.push(event), frames)
    for (let i = 0; i < 5; i++) {
      const event = move(i)
      gate.move(event)
      expect(probed.at(-1)).toBe(event)
      frames.frame()
    }
    expect(probed).toHaveLength(5)
  })

  test('a held button (orbit drag, finger drag) never probes, and drops the move waiting for the next frame', () => {
    const frames = fakeFrames()
    const probed: Event[] = []
    const gate = createHoverGate((event) => probed.push(event), frames)
    gate.move(move(1)); gate.move(move(2))
    gate.move(move(3, 1))
    for (let i = 0; i < 10; i++) { gate.move(move(10 + i, 1)); frames.frame() }
    expect(probed.map((event) => (event as unknown as { x: number }).x)).toEqual([1])
    gate.move(move(30))
    expect(probed).toHaveLength(2)
  })

  test('drop and dispose forget the waiting move', () => {
    const frames = fakeFrames()
    const probed: Event[] = []
    const gate = createHoverGate((event) => probed.push(event), frames)
    gate.move(move(1)); gate.move(move(2))
    gate.drop()
    frames.frame()
    expect(probed).toHaveLength(1)
    gate.move(move(3)); gate.move(move(4))
    gate.dispose()
    expect(frames.waiting).toBe(0)
    frames.frame()
    expect(probed).toHaveLength(2)
  })
})
