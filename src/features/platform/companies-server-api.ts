/**
 * Màn Công ty khi nối backend (`companies` trong `VITE_API_FEATURES`, FE-8-06). Hàm → endpoint:
 *   listServerCompanies       GET   /api/companies (đọc hết các trang) · GET /api/contracts (gói) · GET /api/users (số người dùng)
 *   createServerCompany       POST  /api/companies, rồi POST /api/users (quản trị công ty đầu tiên)
 *   createServerCompanyAdmin  POST  /api/users
 *   updateServerCompany       PUT   /api/companies/{id}
 *   setServerCompanyStatus    PATCH /api/companies/{id}/status
 *   chưa có ở BE: tạo công ty kèm quản trị trong một lần gọi, xoá công ty; địa chỉ, số điện thoại, kho xuất phát của công ty (Q-19)
 * Kiểu của backend dừng ở file này và `company-profile-api.ts` (cùng `CompanyResponse`); màn nhận `ServerCompany…`.
 */

import { createServerUser, fetchServerUsers } from '@/features/admin/users-api'
import { api, ApiError, isApiError } from '@/lib/api-client'
import { fetchAllPages } from '@/lib/api-page'
import { usesBackend } from '@/lib/backend-config'
import { PLAN_TIERS, type PlanTier, type TemporaryPassword } from '@/lib/mock-db'

export const COMPANIES_ON_SERVER = usesBackend('companies')

export const SERVER_COMPANY_STATUSES = ['ACTIVE', 'SUSPENDED', 'EXPIRED'] as const
export type ServerCompanyStatus = (typeof SERVER_COMPANY_STATUSES)[number]

export const SERVER_PLAN_STATUSES = ['ACTIVE', 'TRIAL', 'EXPIRED', 'CANCELLED'] as const
export type ServerPlanStatus = (typeof SERVER_PLAN_STATUSES)[number]

export type ServerCompany = {
  readonly id: string
  readonly code: string
  readonly name: string
  readonly taxCode: string
  readonly billingEmail: string
  /** `null` khi máy chủ trả trạng thái FE chưa biết. */
  readonly status: ServerCompanyStatus | null
  readonly createdAt: string | null
}

export type ServerCompanyPlan = {
  readonly name: string
  readonly tier: PlanTier | null
  readonly status: ServerPlanStatus | null
  /** Thời điểm hết hạn (ISO kèm múi giờ); `null` khi máy chủ không ghi. */
  readonly expiresAt: string | null
}

export type ServerCompanyRow = {
  readonly company: ServerCompany
  /** `null`: công ty chưa có gói, hoặc chưa đọc được gói (`plansLoaded`). */
  readonly plan: ServerCompanyPlan | null
  /** `null` khi chưa đọc được người dùng (`usersLoaded`). */
  readonly userCount: number | null
  /** Công ty đã có tài khoản Quản trị công ty chưa; `null` khi chưa đọc được người dùng. */
  readonly hasAdmin: boolean | null
}

export type ServerCompanyList = {
  readonly rows: ServerCompanyRow[]
  readonly plansLoaded: boolean
  readonly usersLoaded: boolean
  /** Email đã có tài khoản (chữ thường), để kiểm email của quản trị mới trước khi tạo công ty; rỗng khi chưa đọc được người dùng. */
  readonly takenEmails: readonly string[]
}

export type ServerCompanyInput = { readonly name: string; readonly taxCode: string; readonly billingEmail: string }

export type NewServerCompany = ServerCompanyInput & { readonly code: string }

export type NewServerCompanyAdmin = { readonly fullName: string; readonly email: string; readonly phone: string }

/** Tạo công ty và tạo quản trị là hai lần gọi: lần sau hỏng thì công ty vẫn đã có, kết quả mang lỗi đó để màn cho tạo lại quản trị. */
export type ServerCompanyCreated =
  | { readonly company: ServerCompany; readonly admin: TemporaryPassword }
  | { readonly company: ServerCompany; readonly adminError: unknown }

/** `CompanyResponse` của backend — cũng là kết quả của `/api/company/profile` (`company-profile-api.ts`). */
export type CompanyDto = {
  readonly id: number
  readonly companyCode: string
  readonly companyName: string
  readonly taxCode: string | null
  readonly billingEmail: string | null
  readonly status: string | null
  readonly createdAt: string | null
}

type ContractDto = {
  readonly companyId: number | null
  readonly planName: string | null
  readonly planTier: string | null
  readonly status: string | null
  readonly startedAt: string | null
  readonly expiresAt: string | null
}

function oneOf<T extends string>(values: readonly T[], value: unknown): T | null {
  return values.find((item) => item === value) ?? null
}

export function companyOf(dto: CompanyDto): ServerCompany {
  return {
    id: String(dto.id),
    code: dto.companyCode,
    name: dto.companyName,
    taxCode: dto.taxCode ?? '',
    billingEmail: dto.billingEmail ?? '',
    status: oneOf(SERVER_COMPANY_STATUSES, dto.status),
    createdAt: dto.createdAt ?? null,
  }
}

/** Mốc giờ của hợp đồng là `LocalDateTime` không mang múi giờ; máy chủ chạy giờ Việt Nam (`TimeZone.setDefault` lúc khởi động). */
function vietnamInstant(value: string | null): string | null {
  if (value === null || value.trim() === '') return null
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(value) ? value : `${value}+07:00`
}

/** Mỗi công ty một hợp đồng (khoá duy nhất theo công ty ở backend); vẫn lấy bản bắt đầu muộn nhất nếu có nhiều hơn. */
function plansByCompany(contracts: readonly ContractDto[]): Map<string, ServerCompanyPlan> {
  const latest = new Map<string, ContractDto>()
  for (const contract of contracts) {
    if (contract.companyId === null) continue
    const id = String(contract.companyId)
    const current = latest.get(id)
    if (current === undefined || (contract.startedAt ?? '') > (current.startedAt ?? '')) latest.set(id, contract)
  }
  return new Map(
    [...latest].map(([id, dto]) => [
      id,
      { name: dto.planName ?? '', tier: oneOf(PLAN_TIERS, dto.planTier), status: oneOf(SERVER_PLAN_STATUSES, dto.status), expiresAt: vietnamInstant(dto.expiresAt) },
    ]),
  )
}

/** 409 của một endpoint chỉ có một lý do thì mang mã của lý do đó (phong bì lỗi của backend chưa có mã). */
function conflictAs(error: unknown, code: string): unknown {
  return isApiError(error) && error.code === 'CONFLICT' ? new ApiError(code, { status: error.status, params: error.params }) : error
}

/**
 * Mọi công ty kèm gói và số người dùng. Gói và người dùng là hai lần đọc phụ: hỏng thì bảng vẫn hiện công ty, cờ `plansLoaded` /
 * `usersLoaded` cho màn nói phần nào chưa đọc được thay vì ghi "chưa có gói" hay "0 người dùng".
 */
// GET /api/companies · GET /api/contracts · GET /api/users
export async function listServerCompanies(): Promise<ServerCompanyList> {
  const [companies, contracts, users] = await Promise.allSettled([
    fetchAllPages<CompanyDto>('/api/companies', { query: { sort: 'id,asc' } }),
    api().get<ContractDto[]>('/api/contracts'),
    fetchServerUsers(),
  ])
  if (companies.status === 'rejected') throw companies.reason
  const plans = contracts.status === 'fulfilled' && Array.isArray(contracts.value) ? plansByCompany(contracts.value) : null
  const people = users.status === 'fulfilled' ? users.value : null
  return {
    rows: companies.value.map((dto) => {
      const company = companyOf(dto)
      const members = people?.filter((user) => user.companyId === company.id)
      return {
        company,
        plan: plans?.get(company.id) ?? null,
        userCount: members === undefined ? null : members.length,
        hasAdmin: members === undefined ? null : members.some((user) => user.role === 'companyAdmin'),
      }
    }),
    plansLoaded: plans !== null,
    usersLoaded: people !== null,
    takenEmails: people === null ? [] : people.map((user) => user.email.toLowerCase()),
  }
}

/**
 * Backend báo 409 cho cả mã công ty trùng lẫn mã số thuế trùng mà phong bì không nói cái nào: đọc lại danh sách để nói đúng ô. Không
 * đọc được thì giữ lỗi chung.
 */
async function createConflict(error: unknown, input: NewServerCompany): Promise<unknown> {
  if (!isApiError(error) || error.code !== 'CONFLICT') return error
  try {
    const existing = await fetchAllPages<CompanyDto>('/api/companies', { query: { sort: 'id,asc' } })
    if (existing.some((dto) => dto.companyCode === input.code)) return conflictAs(error, 'COMPANY_ALREADY_EXISTS')
    if (existing.some((dto) => dto.taxCode === input.taxCode)) return conflictAs(error, 'TAX_CODE_ALREADY_EXISTS')
  } catch {
    // giữ lỗi 409 chung
  }
  return error
}

/** Quản trị công ty của `companyId`; mật khẩu tạm chỉ có trong kết quả này. Email đã có tài khoản: `EMAIL_ALREADY_EXISTS`. */
// POST /api/users
export function createServerCompanyAdmin(companyId: string, admin: NewServerCompanyAdmin): Promise<TemporaryPassword> {
  return createServerUser({ fullName: admin.fullName, email: admin.email, phone: admin.phone, role: 'companyAdmin', depot: '', companyId })
}

/**
 * Tạo công ty rồi tạo quản trị công ty đầu tiên. Lần gọi đầu hỏng thì ném lỗi (chưa có gì được tạo); lần sau hỏng thì công ty đã có
 * và kết quả mang `adminError` — backend chưa có lối xoá công ty, nên màn cho tạo lại riêng quản trị thay vì tạo lại công ty.
 */
// POST /api/companies, rồi POST /api/users
export async function createServerCompany(input: NewServerCompany, admin: NewServerCompanyAdmin): Promise<ServerCompanyCreated> {
  let company: ServerCompany
  try {
    company = companyOf(
      await api().post<CompanyDto>('/api/companies', {
        body: { companyCode: input.code, companyName: input.name, taxCode: input.taxCode, billingEmail: input.billingEmail },
      }),
    )
  } catch (error) {
    throw await createConflict(error, input)
  }
  try {
    return { company, admin: await createServerCompanyAdmin(company.id, admin) }
  } catch (adminError) {
    return { company, adminError }
  }
}

/** Backend đòi gửi lại mã công ty (bắt buộc) dù không đổi nó; không gửi trạng thái nên trạng thái giữ nguyên. */
// PUT /api/companies/{id}
export async function updateServerCompany(current: ServerCompany, input: ServerCompanyInput): Promise<ServerCompany> {
  try {
    const dto = await api().put<CompanyDto>(`/api/companies/${current.id}`, {
      body: { companyCode: current.code, companyName: input.name, taxCode: input.taxCode, billingEmail: input.billingEmail },
    })
    return companyOf(dto)
  } catch (error) {
    throw conflictAs(error, 'TAX_CODE_ALREADY_EXISTS')
  }
}

/** Trạng thái đi trong tham số `status`, không có thân. */
// PATCH /api/companies/{id}/status
export async function setServerCompanyStatus(id: string, status: 'ACTIVE' | 'SUSPENDED'): Promise<ServerCompany> {
  return companyOf(await api().patch<CompanyDto>(`/api/companies/${id}/status`, { query: { status } }))
}
