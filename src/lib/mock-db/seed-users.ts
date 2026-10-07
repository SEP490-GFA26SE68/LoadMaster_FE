import type { Role, User } from '@/types/user'
import { addDays, vnTime } from './clock'

/** Mật khẩu của mọi tài khoản seed (D-42) — tài khoản demo công khai, không phải credential thật. */
export const SEED_PASSWORD = 'loadmaster'

type UserSeed = Omit<User, 'lastActiveAt'> & {
  /** Lần hoạt động gần nhất: số ngày trước ngày neo và giờ; `null` khi chưa đăng nhập lần nào. */
  lastActive: readonly [daysAgo: number, time: string] | null
}

/** Hai công ty logistics của seed (`seed-sourcing.ts`, PRD v2 mục 5.3): Vận tải Long Bình và Giao nhận Phương Nam. */
export const LONG_BINH = 'LOG-001'
export const PHUONG_NAM = 'LOG-002'

/**
 * 20 người dùng (D-44, FE-0-03, FE-0-06): ba tài khoản nền tảng (không công ty, không kho), mười hai nhân viên của Long Bình và năm
 * tài khoản của Phương Nam — mỗi công ty đủ năm vai trò công ty. Mỗi vai trò có một tài khoản demo — tài khoản **đầu tiên** của vai
 * trò trong danh sách; có một nhân viên kho bị khoá và một điều phối viên chưa đăng nhập lần nào. Mã và email cố định.
 *
 * Mã của tài khoản thêm ở FE-0-03 (`US-NT-…` nền tảng, `US-LB-…` Long Bình, `US-PN-…` Phương Nam) không theo dạng `US-NNNN`: `nextId`
 * không tính chúng. Tài khoản nhà sản xuất `US-0013` và logistics `US-0014` của Review 1 đã bỏ cùng hai vai trò đó (FE-0-06); `US-0015`
 * ở lại nên tài khoản tạo mới vẫn là `US-0016` như các test và E2E đang ghi (quyết định G9).
 */
const USERS: readonly UserSeed[] = [
  { id: 'US-0001', fullName: 'Nguyễn Thanh Tùng', email: 'dieuphoi@loadmaster.vn', phone: '0901 234 567', role: 'dispatcher', status: 'active', depot: 'Kho Long Bình', companyId: LONG_BINH, lastActive: [0, '07:50'] },
  { id: 'US-0002', fullName: 'Trần Thị Mai', email: 'quanly@loadmaster.vn', phone: '0902 345 678', role: 'manager', status: 'active', depot: 'Trụ sở TP. Hồ Chí Minh', companyId: LONG_BINH, lastActive: [0, '08:10'] },
  { id: 'US-0003', fullName: 'Lê Văn Hải', email: 'kho@loadmaster.vn', phone: '0903 456 789', role: 'warehouse', status: 'active', depot: 'Kho Long Bình', companyId: LONG_BINH, lastActive: [0, '05:20'] },
  { id: 'US-0004', fullName: 'Phạm Quốc Dũng', email: 'taixe@loadmaster.vn', phone: '0904 567 890', role: 'driver', status: 'active', depot: 'Kho Long Bình', companyId: LONG_BINH, lastActive: [1, '17:40'] },
  // Tài khoản quản trị cũ thành Quản trị hệ thống (D-65): người của nền tảng, không thuộc công ty hay kho nào
  { id: 'US-0005', fullName: 'Võ Minh Khoa', email: 'quantri@loadmaster.vn', phone: '0905 678 901', role: 'systemAdmin', status: 'active', lastActive: [1, '17:20'] },
  { id: 'US-0006', fullName: 'Ngô Văn Bảo', email: 'bao.ngo@loadmaster.vn', phone: '0906 789 012', role: 'driver', status: 'active', depot: 'Kho Long Bình', companyId: LONG_BINH, lastActive: [0, '06:35'] },
  { id: 'US-0007', fullName: 'Đặng Hoài Nam', email: 'nam.dang@loadmaster.vn', phone: '0907 890 123', role: 'driver', status: 'active', depot: 'Kho Sóng Thần', companyId: LONG_BINH, lastActive: [3, '16:05'] },
  { id: 'US-0008', fullName: 'Bùi Thị Lan', email: 'lan.bui@loadmaster.vn', phone: '0908 901 234', role: 'warehouse', status: 'suspended', depot: 'Kho Sóng Thần', companyId: LONG_BINH, lastActive: [17, '11:15'] },
  { id: 'US-0009', fullName: 'Hoàng Đức Anh', email: 'anh.hoang@loadmaster.vn', phone: '0909 012 345', role: 'dispatcher', status: 'active', depot: 'Kho Sóng Thần', companyId: LONG_BINH, lastActive: null },
  { id: 'US-0010', fullName: 'Trương Văn Lộc', email: 'loc.truong@loadmaster.vn', phone: '0912 345 670', role: 'driver', status: 'active', depot: 'Kho Long Bình', companyId: LONG_BINH, lastActive: [2, '18:10'] },
  { id: 'US-0011', fullName: 'Đỗ Thị Hạnh', email: 'hanh.do@loadmaster.vn', phone: '0913 456 781', role: 'warehouse', status: 'active', depot: 'Kho Sóng Thần', companyId: LONG_BINH, lastActive: [0, '05:45'] },
  { id: 'US-0012', fullName: 'Lý Minh Châu', email: 'chau.ly@loadmaster.vn', phone: '0914 567 892', role: 'manager', status: 'active', depot: 'Trụ sở TP. Hồ Chí Minh', companyId: LONG_BINH, lastActive: [4, '09:30'] },
  // Nhân viên kho của Phương Nam (PRD v2 mục 5.3): trước FE-0-06 là tài khoản logistics của Review 1; giữ mã `US-0015`
  { id: 'US-0015', fullName: 'Lâm Quốc Việt', email: 'viet.lam@phuongnam.vn', phone: '0917 456 320', role: 'warehouse', status: 'active', depot: 'Kho Phú Thuận, Q.7', companyId: PHUONG_NAM, lastActive: [3, '15:10'] },
  // FE-0-03: hai vai trò nền tảng còn lại, Quản trị công ty của Long Bình, và nhân sự của Phương Nam
  { id: 'US-NT-01', fullName: 'Đinh Quang Huy', email: 'nentang@loadmaster.vn', phone: '0918 204 561', role: 'systemManager', status: 'active', lastActive: [2, '10:15'] },
  { id: 'US-NT-02', fullName: 'Tạ Thị Ngọc Ánh', email: 'hotro@loadmaster.vn', phone: '0919 315 672', role: 'systemSupporter', status: 'active', lastActive: [0, '08:30'] },
  { id: 'US-LB-01', fullName: 'Dương Thị Kim Oanh', email: 'qtcongty@loadmaster.vn', phone: '0921 426 783', role: 'companyAdmin', status: 'active', depot: 'Trụ sở TP. Hồ Chí Minh', companyId: LONG_BINH, lastActive: [1, '16:45'] },
  { id: 'US-PN-01', fullName: 'Châu Minh Trí', email: 'qtcongty@phuongnam.vn', phone: '0922 537 894', role: 'companyAdmin', status: 'active', depot: 'Kho Phú Thuận, Q.7', companyId: PHUONG_NAM, lastActive: [1, '09:05'] },
  { id: 'US-PN-02', fullName: 'Mạc Thị Hồng Nhung', email: 'quanly@phuongnam.vn', phone: '0923 648 905', role: 'manager', status: 'active', depot: 'Kho Phú Thuận, Q.7', companyId: PHUONG_NAM, lastActive: [0, '07:55'] },
  { id: 'US-PN-03', fullName: 'Kiều Anh Tuấn', email: 'dieuphoi@phuongnam.vn', phone: '0924 759 016', role: 'dispatcher', status: 'active', depot: 'Kho Phú Thuận, Q.7', companyId: PHUONG_NAM, lastActive: [0, '07:20'] },
  { id: 'US-PN-04', fullName: 'Thái Văn Sơn', email: 'taixe@phuongnam.vn', phone: '0925 860 127', role: 'driver', status: 'active', depot: 'Kho Phú Thuận, Q.7', companyId: PHUONG_NAM, lastActive: [1, '18:20'] },
]

/** Người dùng seed, `lastActiveAt` tính từ ngày neo `today`. */
export function seedUsers(today: string): User[] {
  return USERS.map(({ lastActive, ...user }) => ({
    ...user,
    lastActiveAt: lastActive === null ? null : vnTime(addDays(today, -lastActive[0]), lastActive[1]),
  }))
}

export type DemoAccount = { readonly id: string; readonly role: Role; readonly email: string; readonly companyId: string | undefined }

const demo = ({ id, role, email, companyId }: UserSeed): DemoAccount => ({ id, role, email, companyId })

/**
 * Tài khoản demo của từng vai trò: tài khoản đầu tiên của vai trò, theo thứ tự trong seed. Test đăng nhập theo vai trò bằng danh sách
 * này (`signedInAs`); ô đăng nhập nhanh dùng `QUICK_LOGIN_ACCOUNTS`.
 */
export const DEMO_ACCOUNTS: readonly DemoAccount[] = USERS.filter((user, index) => USERS.findIndex((item) => item.role === user.role) === index).map(demo)

/**
 * Tài khoản hiện ở ô đăng nhập nhanh của màn đăng nhập (FE-0-03): tài khoản nền tảng, rồi của từng công ty — mỗi công ty một tài khoản
 * cho mỗi vai trò (tài khoản đầu tiên của vai trò trong công ty). Màn đăng nhập nhóm theo `companyId`. Cả tám vai trò đều có màn riêng
 * từ Sprint 8 nên không vai trò nào bị ẩn.
 */
export const QUICK_LOGIN_ACCOUNTS: readonly DemoAccount[] = USERS
  .filter((user, index) => USERS.findIndex((item) => item.role === user.role && item.companyId === user.companyId) === index)
  .map(demo)
