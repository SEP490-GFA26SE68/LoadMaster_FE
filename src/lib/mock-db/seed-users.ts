import type { User } from '@/types/user'
import { addDays, vnTime } from './clock'

/** Mật khẩu của mọi tài khoản seed (D-42) — tài khoản demo công khai, không phải credential thật. */
export const SEED_PASSWORD = 'loadmaster'

type UserSeed = Omit<User, 'lastActiveAt'> & {
  /** Lần hoạt động gần nhất: số ngày trước ngày neo và giờ; `null` khi chưa đăng nhập lần nào. */
  lastActive: readonly [daysAgo: number, time: string] | null
}

/**
 * 15 người dùng (D-44, LM-104): đủ 7 vai trò, mỗi vai trò có một tài khoản demo (tài khoản đầu tiên của vai trò, đăng nhập ở màn đăng nhập),
 * một nhân viên kho bị khoá và một điều phối viên chưa đăng nhập lần nào. Mã và email cố định.
 */
const USERS: readonly UserSeed[] = [
  { id: 'US-0001', fullName: 'Nguyễn Thanh Tùng', email: 'dieuphoi@loadmaster.vn', phone: '0901 234 567', role: 'dispatcher', status: 'active', depot: 'Kho Long Bình', lastActive: [0, '07:50'] },
  { id: 'US-0002', fullName: 'Trần Thị Mai', email: 'quanly@loadmaster.vn', phone: '0902 345 678', role: 'manager', status: 'active', depot: 'Trụ sở TP. Hồ Chí Minh', lastActive: [0, '08:10'] },
  { id: 'US-0003', fullName: 'Lê Văn Hải', email: 'kho@loadmaster.vn', phone: '0903 456 789', role: 'warehouse', status: 'active', depot: 'Kho Long Bình', lastActive: [0, '05:20'] },
  { id: 'US-0004', fullName: 'Phạm Quốc Dũng', email: 'taixe@loadmaster.vn', phone: '0904 567 890', role: 'driver', status: 'active', depot: 'Kho Long Bình', lastActive: [1, '17:40'] },
  { id: 'US-0005', fullName: 'Võ Minh Khoa', email: 'quantri@loadmaster.vn', phone: '0905 678 901', role: 'admin', status: 'active', depot: 'Trụ sở TP. Hồ Chí Minh', lastActive: [1, '17:20'] },
  { id: 'US-0006', fullName: 'Ngô Văn Bảo', email: 'bao.ngo@loadmaster.vn', phone: '0906 789 012', role: 'driver', status: 'active', depot: 'Kho Long Bình', lastActive: [0, '06:35'] },
  { id: 'US-0007', fullName: 'Đặng Hoài Nam', email: 'nam.dang@loadmaster.vn', phone: '0907 890 123', role: 'driver', status: 'active', depot: 'Kho Sóng Thần', lastActive: [3, '16:05'] },
  { id: 'US-0008', fullName: 'Bùi Thị Lan', email: 'lan.bui@loadmaster.vn', phone: '0908 901 234', role: 'warehouse', status: 'suspended', depot: 'Kho Sóng Thần', lastActive: [17, '11:15'] },
  { id: 'US-0009', fullName: 'Hoàng Đức Anh', email: 'anh.hoang@loadmaster.vn', phone: '0909 012 345', role: 'dispatcher', status: 'active', depot: 'Kho Sóng Thần', lastActive: null },
  { id: 'US-0010', fullName: 'Trương Văn Lộc', email: 'loc.truong@loadmaster.vn', phone: '0912 345 670', role: 'driver', status: 'active', depot: 'Kho Long Bình', lastActive: [2, '18:10'] },
  { id: 'US-0011', fullName: 'Đỗ Thị Hạnh', email: 'hanh.do@loadmaster.vn', phone: '0913 456 781', role: 'warehouse', status: 'active', depot: 'Kho Sóng Thần', lastActive: [0, '05:45'] },
  { id: 'US-0012', fullName: 'Lý Minh Châu', email: 'chau.ly@loadmaster.vn', phone: '0914 567 892', role: 'manager', status: 'active', depot: 'Trụ sở TP. Hồ Chí Minh', lastActive: [4, '09:30'] },
  // Review 1 (LM-104): nhà sản xuất và công ty logistics — tài khoản demo đầu tiên của mỗi vai trò, và một logistics của công ty khác
  { id: 'US-0013', fullName: 'Phan Thị Thu Trang', email: 'sanxuat@loadmaster.vn', phone: '0915 234 108', role: 'manufacturer', status: 'active', depot: 'Công ty CP Thực phẩm Minh Phát', companyId: 'MFR-001', lastActive: [0, '08:20'] },
  { id: 'US-0014', fullName: 'Huỳnh Văn Phước', email: 'logistics@loadmaster.vn', phone: '0916 345 219', role: 'logistics', status: 'active', depot: 'Kho Long Bình', companyId: 'LOG-001', lastActive: [0, '08:03'] },
  { id: 'US-0015', fullName: 'Lâm Quốc Việt', email: 'viet.lam@phuongnam.vn', phone: '0917 456 320', role: 'logistics', status: 'active', depot: 'Kho Phú Thuận, Q.7', companyId: 'LOG-002', lastActive: [3, '15:10'] },
]

/** Người dùng seed, `lastActiveAt` tính từ ngày neo `today`. */
export function seedUsers(today: string): User[] {
  return USERS.map(({ lastActive, ...user }) => ({
    ...user,
    lastActiveAt: lastActive === null ? null : vnTime(addDays(today, -lastActive[0]), lastActive[1]),
  }))
}

/** Tài khoản demo hiện ở màn đăng nhập: tài khoản đầu tiên của mỗi vai trò, theo thứ tự trong seed. */
export const DEMO_ACCOUNTS = USERS.filter((user, index) => USERS.findIndex((item) => item.role === user.role) === index).map(({ id, role, email }) => ({ id, role, email }))
