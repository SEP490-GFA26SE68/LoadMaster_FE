import type { z } from 'zod'

/** Một lỗi của form đang nhập: đường dẫn trường kiểu react-hook-form (`stops.1.phone`) và câu lỗi đã dịch của schema. */
export type FormIssue = { readonly path: string; readonly message: string }

export type CheckGroup = 'name' | 'vehicle' | 'depot' | 'stops'

/**
 * Trạng thái một dòng của thẻ "Kiểm tra trước khi lưu" (V2.3 TaoChuyen.jpg):
 * `pass` hợp lệ · `fail` có lỗi ở ô người dùng đã chạm (hoặc đã bấm lưu) · `todo` còn ô bắt buộc chưa nhập, chưa chạm tới.
 */
export type CheckState = 'pass' | 'fail' | 'todo'

export type GroupCheck = {
  readonly state: CheckState
  /** Lỗi đầu tiên của nhóm — ô "Tới ô cần sửa" nhảy tới. */
  readonly issue: FormIssue | null
}

export type FormChecks = {
  readonly groups: Record<CheckGroup, GroupCheck>
  /** Số lỗi ở ô đã chạm: dải đỏ "N lỗi cần sửa trước khi lưu". */
  readonly failCount: number
  /** Số ô bắt buộc chưa chạm tới mà còn thiếu. */
  readonly todoCount: number
}

/** Lỗi của giá trị đang nhập theo đúng schema của form — cùng nguồn với lỗi hiện dưới ô, không có luật riêng cho thẻ kiểm tra. */
export function formIssues(schema: z.ZodType, values: unknown): FormIssue[] {
  const result = schema.safeParse(values)
  if (result.success) return []
  return result.error.issues.map((issue) => ({ path: issue.path.map(String).join('.'), message: issue.message }))
}

/** Nhóm của một trường: tên, ngày và giờ xuất phát chung một dòng, xe một dòng, kho xuất phát một dòng, mọi ô của điểm giao một dòng. */
export function groupOf(path: string): CheckGroup {
  if (path === 'vehicleId' || path === 'driverId') return 'vehicle'
  if (path === 'depot' || path.startsWith('depot.')) return 'depot'
  if (path === 'stops' || path.startsWith('stops.')) return 'stops'
  return 'name'
}

/** `seen(path)`: người dùng đã chạm ô đó hoặc đã bấm lưu — lúc đó lỗi mới là lỗi, trước đó chỉ là ô chưa nhập. */
export function formChecks(issues: readonly FormIssue[], seen: (path: string) => boolean): FormChecks {
  const groups: Record<CheckGroup, GroupCheck> = {
    name: { state: 'pass', issue: null },
    vehicle: { state: 'pass', issue: null },
    depot: { state: 'pass', issue: null },
    stops: { state: 'pass', issue: null },
  }
  let failCount = 0
  let todoCount = 0
  for (const issue of issues) {
    const group = groupOf(issue.path)
    const current = groups[group]
    if (seen(issue.path)) {
      failCount += 1
      if (current.state !== 'fail') groups[group] = { state: 'fail', issue }
    } else {
      todoCount += 1
      if (current.state === 'pass') groups[group] = { state: 'todo', issue }
    }
  }
  return { groups, failCount, todoCount }
}

/** Đường dẫn điểm giao `stops.<i>.<trường>` thành số thứ tự 1-based và tên trường; đường dẫn khác thì `null`. */
export function stopFieldOf(path: string): { number: number; field: string } | null {
  const match = /^stops\.(\d+)\.(\w+)$/.exec(path)
  if (!match?.[1] || !match[2]) return null
  return { number: Number(match[1]) + 1, field: match[2] }
}
