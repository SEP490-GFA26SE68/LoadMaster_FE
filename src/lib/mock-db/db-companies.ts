import type { User } from '@/types/user'
import { effectiveSubscriptionStatus } from './billing-model'
import type { CompaniesDb, CompanyInfo, NewCompanyAdmin } from './db-api-companies'
import { nextId, put, sameData, type DbContext } from './db-context'
import { temporaryPassword } from './db-users'
import { MockDbError } from './errors'
import { assertRole } from './session-role'
import type { Company, CompanyDepot } from './source-types'

/** Giới hạn độ dài của chữ nhập vào (tên, địa chỉ); kho kiểm cả khi giao diện đã kiểm. */
const MAX_NAME = 120
const MAX_ADDRESS = 200
const MAX_PHONE = 20

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const COMPANY_FIELDS = ['companyName', 'address', 'phone', 'departureDepot'] as const

const bad = (field: string) => new MockDbError('COMPANY_INVALID', { field })

/** Chữ bắt buộc: đã bỏ khoảng trắng hai đầu, không trống, không quá `max`. */
function required(value: unknown, field: string, max: number): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text === '' || text.length > max) throw bad(field)
  return text
}

function validDepot(depot: CompanyDepot | undefined): CompanyDepot {
  if (depot === undefined) throw bad('depot')
  const inRange = (value: unknown, limit: number) => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit
  if (!inRange(depot.lat, 90) || !inRange(depot.lng, 180)) throw bad('depot.coordinates')
  return {
    name: required(depot.name, 'depot.name', MAX_NAME),
    address: typeof depot.address === 'string' ? depot.address.trim().slice(0, MAX_ADDRESS) : '',
    lat: depot.lat,
    lng: depot.lng,
  }
}

function validInfo(input: CompanyInfo): Omit<Company, 'id'> {
  return {
    name: required(input.name, 'name', MAX_NAME),
    address: required(input.address, 'address', MAX_ADDRESS),
    phone: required(input.phone, 'phone', MAX_PHONE),
    depot: validDepot(input.depot),
  }
}

function validAdmin(admin: NewCompanyAdmin | undefined): NewCompanyAdmin {
  const email = required(admin?.email, 'admin.email', 120)
  if (!EMAIL_PATTERN.test(email)) throw bad('admin.email')
  return {
    fullName: required(admin?.fullName, 'admin.fullName', 80),
    email,
    phone: required(admin?.phone, 'admin.phone', MAX_PHONE),
  }
}

/**
 * Công ty do quản trị hệ thống quản lý (FE-8-06, D-65). Công ty không phải dữ liệu vận hành: phiên nền tảng đọc được hết
 * (`ctx.scope.companies`), nhưng chỉ quản trị hệ thống (`companies.manage`) xem danh sách kèm gói, tạo và sửa. Công ty mới **chưa có
 * gói** (D-94) và không mang dữ liệu vận hành nào; Quản trị công ty đầu tiên là tài khoản vai trò công ty duy nhất được tạo ngoài phạm
 * vi của `createUser` (phiên nền tảng chỉ tạo vai trò nền tảng, FE-0-08) nên luật đó nằm ở đây.
 */
export function companyMethods(ctx: DbContext): CompaniesDb {
  const { companies, users, passwords } = ctx.state

  const companyTarget = (id: string) => ({ type: 'company' as const, id })

  return {
    listCompanyOverview: () =>
      ctx.respond(() => {
        assertRole(ctx, 'systemAdmin')
        const now = ctx.nowIso()
        const subscriptions = ctx.scope.platformSubscriptions.list()
        const accounts = ctx.scope.users.list()
        return ctx.scope.companies.list().map((company) => {
          const subscription = subscriptions.find((item) => item.companyId === company.id)
          return {
            company,
            current: subscription ? { subscription, plan: ctx.scope.plans.read(subscription.planId) } : null,
            planStatus: subscription ? effectiveSubscriptionStatus(subscription, now) : null,
            userCount: accounts.filter((user) => user.companyId === company.id).length,
          }
        })
      }),

    createCompany: (input) =>
      ctx.respond(() => {
        assertRole(ctx, 'systemAdmin')
        const info = validInfo(input)
        const admin = validAdmin(input.admin)
        const owner = [...users.values()].find((user) => user.email.toLowerCase() === admin.email.toLowerCase())
        if (owner) throw new MockDbError('EMAIL_TAKEN', { email: admin.email })

        const company = put(companies, { id: nextId('LOG', companies.keys()), ...info })
        // Sự kiện của công ty do tài khoản nền tảng tạo không thuộc công ty nào: quản trị hệ thống đọc ở nhật ký toàn hệ thống
        ctx.log('company.created', companyTarget(company.id), { name: company.name }, null)
        const user: User = put(users, {
          id: nextId('US', users.keys(), 4), ...admin, role: 'companyAdmin', status: 'active', depot: info.depot.name, companyId: company.id, lastActiveAt: null,
        })
        const password = temporaryPassword()
        passwords.set(user.id, password)
        ctx.log('user.created', { type: 'user', id: user.id }, { fullName: user.fullName, role: user.role })
        return { company, user, temporaryPassword: password }
      }),

    updateCompany: (id, input) =>
      ctx.respond(() => {
        const current = ctx.scope.companies.own(id)
        assertRole(ctx, 'systemAdmin')
        const next = { id, ...validInfo(input) }
        const same = {
          companyName: current.name === next.name,
          address: current.address === next.address,
          phone: current.phone === next.phone,
          departureDepot: sameData(current.depot, next.depot),
        }
        const changed = COMPANY_FIELDS.filter((field) => !same[field])
        if (changed.length === 0) return current
        ctx.log('company.updated', companyTarget(id), { fields: changed.join(',') }, null)
        return put(companies, next)
      }),
  }
}
