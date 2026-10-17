import type { User } from '@/types/user'
import type { CurrentSubscription, SubscriptionStatus } from './billing-model'
import type { Company, CompanyDepot } from './source-types'

/** Thông tin sửa được của công ty (FE-8-06): tên, địa chỉ, số điện thoại và kho xuất phát. */
export type CompanyInfo = Pick<Company, 'name' | 'address' | 'phone'> & { depot: CompanyDepot }

/** Thông tin công ty mà Quản trị công ty tự sửa ở `/cong-ty`: tên, địa chỉ, số điện thoại — kho xuất phát vẫn do quản trị hệ thống sửa. */
export type CompanyProfileChanges = Pick<Company, 'name' | 'address' | 'phone'>

/** Quản trị công ty đầu tiên đi cùng công ty mới: tài khoản đang hoạt động, kho / chi nhánh là tên kho xuất phát. */
export type NewCompanyAdmin = Pick<User, 'fullName' | 'email' | 'phone'>

export type NewCompany = CompanyInfo & { admin: NewCompanyAdmin }

/** Công ty vừa tạo và quản trị công ty đầu tiên; mật khẩu tạm chỉ trả về một lần (D-42). */
export type CreatedCompany = { company: Company; user: User; temporaryPassword: string }

/** Một dòng của danh sách công ty: gói hiện tại (vắng khi chưa từng đăng ký), trạng thái gói theo đồng hồ của kho và số người dùng. */
export type CompanyOverview = {
  company: Company
  current: CurrentSubscription | null
  planStatus: SubscriptionStatus | null
  userCount: number
}

/**
 * Phần kho của công ty (FE-8-06, D-65). Cùng quy ước với `MockDb`: bất đồng bộ, trả bản sao, từ chối bằng `MockDbError`, mỗi lệnh ghi
 * thêm một sự kiện nhật ký. Chỉ quản trị hệ thống (`companies.manage`) gọi được, trừ hai hàm Thông tin công ty của chính phiên; kho
 * không có phiên — test logic — thì không xét vai trò. Sai vai trò là `ROLE_NOT_ALLOWED`, xét sau công ty.
 */
export type CompaniesDb = {
  /** Mọi công ty kèm gói và số người dùng, theo thứ tự tạo. */
  listCompanyOverview(): Promise<CompanyOverview[]>
  /**
   * Tạo công ty (`LOG-NNN`, chưa có gói) cùng Quản trị công ty đầu tiên (đang hoạt động, kho / chi nhánh là kho xuất phát). Thiếu hoặc
   * sai dữ liệu: `COMPANY_INVALID` kèm trường; email đã có: `EMAIL_TAKEN`. Ghi `company.created` và `user.created`.
   */
  createCompany(input: NewCompany): Promise<CreatedCompany>
  /** Sửa thông tin và kho xuất phát; không đổi gì thì không ghi nhật ký. Ghi `company.updated`. */
  updateCompany(id: string, input: CompanyInfo): Promise<Company>
  /**
   * Công ty của phiên — Thông tin công ty `/cong-ty`. Như `GET /api/company/profile` của backend: quản trị công ty, quản lý công ty và
   * điều phối viên đọc được; vai trò nền tảng `COMPANY_REQUIRED`.
   */
  getCompanyProfile(): Promise<Company>
  /**
   * Quản trị công ty sửa tên, địa chỉ, số điện thoại của công ty mình (như `PATCH /api/company/profile`, chỉ quản trị công ty); kho xuất
   * phát giữ nguyên. Sai dữ liệu: `COMPANY_INVALID` kèm trường. Ghi `company.updated` thuộc công ty; không đổi gì thì không ghi.
   */
  updateCompanyProfile(changes: CompanyProfileChanges): Promise<Company>
}
