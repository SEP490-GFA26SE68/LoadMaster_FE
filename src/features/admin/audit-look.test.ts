import { KeyRound, MapPin, Route, UserRound } from 'lucide-react'
import { expect, test } from 'vitest'
import { AUDIT_ACTIONS, type AuditAction } from '@/lib/mock-db'
import { actorInitials, auditActionLook } from './audit-look'

/** Dáng của một dòng nhật ký (V2): icon theo nhóm hành động, tint theo nghĩa cố định của AGENTS mục 4, chữ tắt của người làm. */
const toneOf = (actions: readonly AuditAction[]) => actions.map((action) => auditActionLook(action).tone)

test('việc cần người xem lại là hổ phách: sự cố, thiếu kiện, huỷ, đăng nhập sai, khoá tài khoản, đưa xe vào bảo dưỡng', () => {
  const attention = ['delivery.issue', 'loading.missing', 'trip.cancelled', 'auth.signInFailed', 'user.locked', 'vehicle.maintenanceOn'] as const
  expect(toneOf(attention)).toStrictEqual(attention.map(() => 'amber'))
  expect(AUDIT_ACTIONS.filter((action) => auditActionLook(action).tone === 'amber')).toStrictEqual(
    AUDIT_ACTIONS.filter((action) => (attention as readonly string[]).includes(action)),
  )
})

test('xong hoặc sẵn sàng là xanh lá; vận hành là xanh dương; kết quả tối ưu là xanh lam; tài khoản và phiên là xám', () => {
  expect(toneOf(['loading.completed', 'delivery.stopCompleted', 'delivery.completed', 'revision.approved', 'vehicle.maintenanceOff']))
    .toStrictEqual(['green', 'green', 'green', 'green', 'green'])
  expect(toneOf(['trip.created', 'trip.updated', 'loading.started', 'delivery.started', 'vehicle.created', 'vehicle.updated']))
    .toStrictEqual(['blue', 'blue', 'blue', 'blue', 'blue', 'blue'])
  expect(toneOf(['optimization.saved'])).toStrictEqual(['azure'])
  expect(toneOf(['auth.signedIn', 'auth.signedOut', 'user.created', 'user.passwordReset', 'user.deleted', 'vehicle.deleted']))
    .toStrictEqual(['slate', 'slate', 'slate', 'slate', 'slate', 'slate'])
})

test('icon theo nhóm hành động: cùng nhóm cùng icon, dù tint khác nhau', () => {
  expect(auditActionLook('trip.created').icon).toBe(Route)
  expect(auditActionLook('trip.cancelled').icon).toBe(Route)
  expect(auditActionLook('delivery.issue').icon).toBe(MapPin)
  expect(auditActionLook('auth.signInFailed').icon).toBe(KeyRound)
  expect(auditActionLook('user.locked').icon).toBe(UserRound)
})

test('chữ tắt là chữ đầu của hai tiếng cuối (tên đệm + tên), viết hoa, giữ dấu', () => {
  expect(actorInitials('Nguyễn Thanh Tùng')).toBe('TT')
  expect(actorInitials('Đỗ Thị Hạnh')).toBe('TH')
  expect(actorInitials('  Võ   Minh Khoa ')).toBe('MK')
  expect(actorInitials('Khoa')).toBe('K')
  expect(actorInitials('ánh ơn')).toBe('ÁƠ')
  // Chữ ghép từ dấu rời (NFD) vẫn ra một ký tự
  expect(actorInitials('Lê Văn Ơn'.normalize('NFD'))).toBe('VƠ')
  expect(actorInitials('')).toBe('')
})
