import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { scrollResultsIntoView } from './try-scroll'

const VIEWPORT = 900

/** Phần tử có hộp đo (top, height) cho jsdom — nó không bố cục nên mọi hộp đo đều là 0. */
function boxed(top: number, height: number): { element: HTMLElement; scroll: ReturnType<typeof vi.fn> } {
  const element = document.createElement('div')
  const scroll = vi.fn()
  element.scrollIntoView = scroll
  element.getBoundingClientRect = () => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) })
  return { element, scroll }
}

beforeEach(() => {
  vi.stubGlobal('innerHeight', VIEWPORT)
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia
})
afterEach(() => vi.unstubAllGlobals())

it('scrolls when the column starts above the header line', () => {
  const { element, scroll } = boxed(-108, 630)
  scrollResultsIntoView(element)
  expect(scroll).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
})

it('scrolls when the column runs past the bottom edge', () => {
  const { element, scroll } = boxed(400, 630)
  scrollResultsIntoView(element)
  expect(scroll).toHaveBeenCalledTimes(1)
})

it('leaves the page alone when the column is fully in view', () => {
  const { element, scroll } = boxed(80, 630)
  scrollResultsIntoView(element)
  expect(scroll).not.toHaveBeenCalled()
})

it('leaves the page alone when the column is taller than the screen', () => {
  const { element, scroll } = boxed(-50, 1100)
  scrollResultsIntoView(element)
  expect(scroll).not.toHaveBeenCalled()
})

it('jumps instead of gliding when the visitor prefers reduced motion', () => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia
  const { element, scroll } = boxed(-108, 630)
  scrollResultsIntoView(element)
  expect(scroll).toHaveBeenCalledWith({ block: 'nearest', behavior: 'auto' })
})

it('does nothing without an element', () => {
  expect(() => scrollResultsIntoView(null)).not.toThrow()
})
