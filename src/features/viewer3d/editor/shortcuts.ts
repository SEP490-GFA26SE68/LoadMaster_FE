import { EDITOR_NUDGE_STEPS_CM, type Axis } from './geometry'

/** Bước dời khi giữ Shift cùng mũi tên / Page Up/Down: bước lớn nhất của nút dời. */
export const LARGE_NUDGE_CM = Math.max(...EDITOR_NUDGE_STEPS_CM)

export type EditorShortcut =
  | { kind: 'undo' } | { kind: 'redo' }
  | { kind: 'nudge'; axis: Axis; direction: 1 | -1; large: boolean }
  | { kind: 'rotate'; back: boolean }
  | { kind: 'pin' } | { kind: 'deselect' }

type KeyInput = Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'shiftKey' | 'altKey'>

const MOVES: Record<string, readonly [Axis, 1 | -1]> = {
  ArrowRight: ['x', 1], ArrowLeft: ['x', -1], ArrowUp: ['y', 1], ArrowDown: ['y', -1], PageUp: ['z', 1], PageDown: ['z', -1],
}

/**
 * Phím tắt của chế độ Chỉnh sửa → việc (thuần, để test không cần DOM). Ctrl/Cmd + Z hoàn tác, thêm Shift hoặc Ctrl/Cmd + Y làm lại;
 * mũi tên dời X/Y, Page Up/Down dời Z, giữ Shift là bước lớn; R xoay sang hướng được phép kế tiếp, Shift + R hướng trước; P ghim /
 * bỏ ghim; Esc bỏ chọn kiện. Alt đi kèm thì không phải phím tắt của editor.
 */
export function editorShortcut(event: KeyInput): EditorShortcut | null {
  if (event.altKey) return null
  const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
  if (event.ctrlKey || event.metaKey) {
    if (key === 'z') return { kind: event.shiftKey ? 'redo' : 'undo' }
    if (key === 'y' && !event.shiftKey) return { kind: 'redo' }
    return null
  }
  const move = MOVES[key]
  if (move) return { kind: 'nudge', axis: move[0], direction: move[1], large: event.shiftKey }
  if (key === 'r') return { kind: 'rotate', back: event.shiftKey }
  if (key === 'p' && !event.shiftKey) return { kind: 'pin' }
  if (key === 'Escape') return { kind: 'deselect' }
  return null
}
