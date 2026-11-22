import { expect, test } from 'vitest'
import type { ScenePlacement } from '../scene-types'
import { previewSemantics } from './preview-semantics'
const placements = [{ id: 'a', step: 1 }, { id: 'b', step: 2 }, { id: 'c', step: 3 }] as ScenePlacement[]
test('selecting step 3 leaves all placements visible and no fake confirmations', () => {
  const result = previewSemantics(placements, 'c')
  expect([...result.appearanceById.values()].map((a) => a.visibility)).toEqual(['opaque', 'opaque', 'opaque'])
  expect([...result.appearanceById.values()].map((a) => a.state)).toEqual(['future', 'future', 'future'])
  expect(result.currentId).toBeNull()
  expect(result.nextId).toBeNull()
  expect(result.appearanceById.get('c')?.tone).toBe('current')
})
test('only backend confirmed IDs count; isolate changes visibility only', () => {
  const result = previewSemantics(placements, 'c', new Set(['a']), true)
  expect([...result.appearanceById.values()].map((a) => [a.state, a.visibility])).toEqual([
    ['loaded', 'hidden'], ['future', 'hidden'], ['future', 'opaque'],
  ])
})
