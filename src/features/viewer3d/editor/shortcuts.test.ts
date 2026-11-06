import { expect, test } from 'vitest'
import { editorShortcut, LARGE_NUDGE_CM } from './shortcuts'

const press = (key: string, mods: { ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean } = {}) =>
  editorShortcut({ key, ctrlKey: Boolean(mods.ctrl), metaKey: Boolean(mods.meta), shiftKey: Boolean(mods.shift), altKey: Boolean(mods.alt) })

test('undo is Ctrl or Cmd + Z; redo is the same with Shift, or Ctrl / Cmd + Y', () => {
  expect([press('z', { ctrl: true }), press('z', { meta: true }), press('Z', { ctrl: true, shift: true }), press('y', { ctrl: true }),
    press('y', { meta: true })]).toStrictEqual([{ kind: 'undo' }, { kind: 'undo' }, { kind: 'redo' }, { kind: 'redo' }, { kind: 'redo' }])
})

test('arrows nudge X and Y, Page Up / Down nudge Z, and Shift asks for the large step', () => {
  expect([press('ArrowRight'), press('ArrowDown', { shift: true }), press('PageUp'), press('PageDown', { shift: true })]).toStrictEqual([
    { kind: 'nudge', axis: 'x', direction: 1, large: false },
    { kind: 'nudge', axis: 'y', direction: -1, large: true },
    { kind: 'nudge', axis: 'z', direction: 1, large: false },
    { kind: 'nudge', axis: 'z', direction: -1, large: true },
  ])
  expect(LARGE_NUDGE_CM).toBe(10)
})

test('R turns to the next allowed orientation and Shift + R to the previous one; P pins; Esc deselects', () => {
  expect([press('r'), press('R', { shift: true }), press('p'), press('Escape')]).toStrictEqual([
    { kind: 'rotate', back: false }, { kind: 'rotate', back: true }, { kind: 'pin' }, { kind: 'deselect' },
  ])
})

test('keys the browser or the system owns are left alone', () => {
  expect([press('r', { ctrl: true }), press('ArrowLeft', { alt: true }), press('p', { meta: true }), press('a'), press('Tab')])
    .toStrictEqual([null, null, null, null, null])
})
