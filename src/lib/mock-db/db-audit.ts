import { vnDate } from './clock'
import type { DbContext } from './db-context'
import type { MockDb } from './types'

/**
 * Nhật ký (D-43): mới nhất trước, lọc theo ngày giờ Việt Nam, người làm, mã đối tượng (chứa chuỗi, không phân biệt hoa thường).
 * Nhật ký không phải dữ liệu vận hành (D-64): phiên của một công ty chỉ đọc sự kiện của công ty mình, phiên nền tảng đọc hết.
 */
export function auditMethods(ctx: DbContext): Pick<MockDb, 'listEvents' | 'listAuditNames'> {
  return {
    listEvents: (filter = {}) =>
      ctx.respond(() => {
        const target = filter.targetId?.trim().toLowerCase()
        return ctx.scope.events()
          .filter((event) => {
            const day = vnDate(new Date(event.at))
            if (filter.from !== undefined && day < filter.from) return false
            if (filter.to !== undefined && day > filter.to) return false
            if (filter.actorId !== undefined && event.actorId !== filter.actorId) return false
            return !target || event.target.id.toLowerCase().includes(target)
          })
          .toReversed()
      }),
    listAuditNames: () =>
      ctx.respond(() => {
        const { trips, vehicles } = ctx.scope.auditTargets()
        return {
          users: ctx.scope.users.list().map(({ id, fullName, role }) => ({ id, fullName, role })),
          trips: trips.map(({ id, name }) => ({ id, name })),
          vehicles: vehicles.map(({ id, name }) => ({ id, name })),
        }
      }),
  }
}
