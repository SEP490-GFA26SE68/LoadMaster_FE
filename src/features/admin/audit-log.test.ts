import { expect, test } from 'vitest'
import { createFormatter } from '@/lib/format'
import { createTranslator } from '@/lib/i18n'
import type { AuditAction, AuditEvent, AuditTargetType } from '@/lib/mock-db'
import { describeEvent, describeLogRow, type AuditDirectory } from './audit-log'

/** Cách đọc một sự kiện nhật ký (LM-091, D-43): kho chỉ lưu mã và tham số, màn dịch và format theo ngôn ngữ. */
const vi = { t: createTranslator('vi'), format: createFormatter('vi-VN') }
const en = { t: createTranslator('en'), format: createFormatter('en-US') }

const DIRECTORY: AuditDirectory = {
  users: new Map([['US-0001', 'Nguyễn Thanh Tùng'], ['US-0010', 'Trương Văn Lộc']]),
  trips: new Map([['TRIP-004', 'Tuyến Tân An – Biên Hoà']]),
  vehicles: new Map([['VEHICLE-008', 'Hyundai Mighty EX8 · 50H-118.29']]),
}

function event(
  action: AuditAction,
  target: { type: AuditTargetType; id: string },
  params: Record<string, string | number> = {},
  actorId: string | null = 'US-0001',
): AuditEvent {
  return { id: 'EV-000200', at: '2026-09-13T11:05:00.000Z', actorId, companyId: 'LOG-001', action, target, params }
}

/** Người xem mở được mọi trang đích: liên kết chỉ còn phụ thuộc vào đối tượng có còn trong kho hay không. */
const canOpenAll = () => true

function describe(value: AuditEvent, { t, format } = vi) {
  return describeEvent(value, DIRECTORY, t, format, canOpenAll)
}

test('huỷ chuyến: người làm, hành động, chuyến dẫn tới chi tiết và lý do người dùng nhập', () => {
  expect(describe(event('trip.cancelled', { type: 'trip', id: 'TRIP-004' }, { reason: 'Khách hoãn nhận hàng' }))).toStrictEqual({
    id: 'EV-000200',
    at: '2026-09-13T11:05:00.000Z',
    actorId: 'US-0001',
    actor: 'Nguyễn Thanh Tùng',
    action: 'Huỷ chuyến',
    target: { id: 'TRIP-004', label: 'Tuyến Tân An – Biên Hoà', href: '/chuyen/TRIP-004' },
    details: 'Lý do: Khách hoãn nhận hàng',
  })
})

test('số trong tham số theo định dạng của ngôn ngữ', () => {
  const saved = event('optimization.saved', { type: 'trip', id: 'TRIP-004' }, { revisionId: 'REV-031', placed: 1320, unplaced: 0 })
  expect(describe(saved).details).toBe('Phương án: REV-031 · Xếp được: 1.320 · Không xếp được: 0')
  expect(describe(saved, en).details).toBe('Plan: REV-031 · Placed: 1,320 · Not placed: 0')
  expect(describe(saved, en).action).toBe('Saved optimization result')
})

test('mã trong tham số được dịch: tên trường, loại sự cố, vai trò, lý do khoá', () => {
  const edited = event('trip.updated', { type: 'trip', id: 'TRIP-004' }, { fields: 'packages,scheduledDate' })
  expect(describe(edited).details).toBe('Trường đã sửa: Kiện hàng và Ngày chạy')
  expect(describe(edited, en).details).toBe('Fields changed: Packages and Scheduled date')

  const issue = event('delivery.issue', { type: 'trip', id: 'TRIP-004' }, { kind: 'refused', stopNumber: 2, packageInstanceId: 'PKG-003-11' })
  // Nhãn loại sự cố dùng chung với màn tài xế (`common.deliveryIssueKinds`, LM-100)
  expect(describe(issue).details).toBe('Loại sự cố: Khách từ chối · Điểm giao: 2 · Kiện: PKG-003-11')

  const created = event('user.created', { type: 'user', id: 'US-0010' }, { fullName: 'Trương Văn Lộc', role: 'driver' }, 'US-0005')
  expect(describe(created)).toMatchObject({
    actor: 'Tài khoản đã xoá (US-0005)',
    target: { id: 'US-0010', label: 'Trương Văn Lộc', href: '/nguoi-dung?q=US-0010' },
    details: 'Họ tên: Trương Văn Lộc · Vai trò: Tài xế',
  })

  const locked = event('auth.signInFailed', { type: 'user', id: 'US-0010' }, { email: 'loc.truong@loadmaster.vn', reason: 'suspended' }, null)
  expect(describe(locked).details).toBe('Email: loc.truong@loadmaster.vn · Lý do: Tài khoản đã bị khoá')
})

test('không có phiên: đăng nhập sai là "Chưa đăng nhập", việc khác là "Hệ thống"; email lạ không có liên kết', () => {
  const failed = event('auth.signInFailed', { type: 'user', id: 'khong.co@loadmaster.vn' }, { email: 'khong.co@loadmaster.vn' }, null)
  expect(describe(failed)).toMatchObject({
    actor: 'Chưa đăng nhập',
    action: 'Đăng nhập không thành công',
    target: { id: 'khong.co@loadmaster.vn', label: null, href: null },
  })
  expect(describe(event('vehicle.maintenanceOff', { type: 'vehicle', id: 'VEHICLE-008' }, {}, null))).toMatchObject({
    actor: 'Hệ thống',
    target: { label: 'Hyundai Mighty EX8 · 50H-118.29', href: '/doi-xe/VEHICLE-008' },
    details: '',
  })
})

test('đối tượng đã xoá khỏi kho: giữ tên trong tham số, không dẫn tới trang không còn', () => {
  expect(describe(event('vehicle.deleted', { type: 'vehicle', id: 'VEHICLE-009' }, { name: 'Isuzu QKR · 51C-000.01' })).target)
    .toStrictEqual({ id: 'VEHICLE-009', label: 'Isuzu QKR · 51C-000.01', href: null })
  expect(describe(event('user.deleted', { type: 'user', id: 'US-0013' }, { fullName: 'Mai Văn Phúc' })).target)
    .toStrictEqual({ id: 'US-0013', label: 'Mai Văn Phúc', href: null })
  // Tham số chưa có nhãn vẫn hiện, theo đúng tên kho ghi
  expect(describe(event('trip.created', { type: 'trip', id: 'TRIP-004' }, { source: 'csv' })).details).toBe('source: csv')
})

test('dòng của màn nhật ký: mã hành động, chữ tắt và vai trò hiện tại của người làm; không còn tài khoản thì không có hai thứ đó', () => {
  const directory: AuditDirectory = { ...DIRECTORY, roles: new Map([['US-0001', 'dispatcher']]) }
  const cancelled = event('trip.cancelled', { type: 'trip', id: 'TRIP-004' }, { reason: 'Khách hoãn nhận hàng' })
  expect(describeLogRow(cancelled, directory, vi.t, vi.format, canOpenAll)).toStrictEqual({
    ...describe(cancelled),
    actionCode: 'trip.cancelled',
    actorInitials: 'TT',
    actorRole: 'Điều phối viên',
  })
  expect(describeLogRow(cancelled, directory, en.t, en.format, canOpenAll)).toMatchObject({ actorInitials: 'TT', actorRole: 'Dispatcher' })
  // Có tên nhưng kho không trả vai trò: chữ tắt vẫn có, vai trò thì không
  expect(describeLogRow(event('auth.signedIn', { type: 'user', id: 'US-0010' }, {}, 'US-0010'), directory, vi.t, vi.format, canOpenAll))
    .toMatchObject({ actor: 'Trương Văn Lộc', actorInitials: 'VL', actorRole: null })
  expect(describeLogRow(event('vehicle.maintenanceOff', { type: 'vehicle', id: 'VEHICLE-008' }, {}, null), directory, vi.t, vi.format, canOpenAll))
    .toMatchObject({ actor: 'Hệ thống', actorInitials: null, actorRole: null })
  expect(describeLogRow(event('user.created', { type: 'user', id: 'US-0010' }, {}, 'US-0005'), directory, vi.t, vi.format, canOpenAll))
    .toMatchObject({ actor: 'Tài khoản đã xoá (US-0005)', actorInitials: null, actorRole: null })
})

test('đối tượng chỉ là liên kết khi người xem có quyền mở trang đích: quản trị viên đọc nhật ký nhưng không xem được chuyến, xe (FE-0-03)', () => {
  // Quyền của quản trị hệ thống và quản trị công ty liên quan tới nhật ký: người dùng có, chuyến và xe không
  const adminCan = (permission: string) => permission === 'users.manage' || permission === 'audit.view'
  const target = (value: AuditEvent) => describeEvent(value, DIRECTORY, vi.t, vi.format, adminCan).target

  expect(target(event('trip.cancelled', { type: 'trip', id: 'TRIP-004' }, { reason: 'Khách hoãn nhận hàng' })))
    .toStrictEqual({ id: 'TRIP-004', label: 'Tuyến Tân An – Biên Hoà', href: null })
  expect(target(event('vehicle.maintenanceOff', { type: 'vehicle', id: 'VEHICLE-008' })))
    .toStrictEqual({ id: 'VEHICLE-008', label: 'Hyundai Mighty EX8 · 50H-118.29', href: null })
  expect(target(event('user.locked', { type: 'user', id: 'US-0010' })))
    .toStrictEqual({ id: 'US-0010', label: 'Trương Văn Lộc', href: '/nguoi-dung?q=US-0010' })
  // Đơn hàng, kiện của kho kiện, loại kiện, loại xe theo quyền của màn đó
  expect(target(event('order.created', { type: 'order', id: 'ORD-001' }, { customerName: 'Co.opmart Bình Dương', count: 12 })).href).toBeNull()
  expect(target(event('package.created', { type: 'package', id: 'PK-0001' }, { count: 12 })).href).toBeNull()
  expect(target(event('packageType.created', { type: 'packageType', id: 'PT-001' }, { name: 'Thùng nước suối 24 chai' })).href).toBeNull()
  expect(target(event('vehicleType.created', { type: 'vehicleType', id: 'VT-001' }, { name: 'Xe tải 5 tấn thùng 6 m' })).href).toBeNull()

  // Điều phối viên: mở được chuyến, xe, đơn hàng, kho kiện (`packages.view`) và loại kiện (`packages.manage`); không mở được người dùng
  const dispatcherCan = (permission: string) => ['trips.view', 'fleet.view', 'orders.view', 'packages.view', 'packages.manage'].includes(permission)
  const forDispatcher = (value: AuditEvent) => describeEvent(value, DIRECTORY, vi.t, vi.format, dispatcherCan).target.href
  expect(forDispatcher(event('trip.cancelled', { type: 'trip', id: 'TRIP-004' }))).toBe('/chuyen/TRIP-004')
  expect(forDispatcher(event('vehicleType.created', { type: 'vehicleType', id: 'VT-001' }))).toBe('/doi-xe/loai-xe')
  expect(forDispatcher(event('order.created', { type: 'order', id: 'ORD-001' }))).toBe('/don-hang?q=ORD-001')
  expect(forDispatcher(event('package.created', { type: 'package', id: 'PK-0001' }))).toBe('/kien-hang?q=PK-0001')
  expect(forDispatcher(event('packageType.created', { type: 'packageType', id: 'PT-001' }))).toBe('/loai-kien')
  expect(forDispatcher(event('user.locked', { type: 'user', id: 'US-0010' }))).toBeNull()
  // Quản lý công ty xem kho kiện (`packages.view`, FE-3b-03) nên mở được kiện; danh mục loại kiện vẫn là của điều phối viên
  const managerCan = (permission: string) => ['trips.view', 'fleet.view', 'orders.view', 'packages.view'].includes(permission)
  const forManager = (value: AuditEvent) => describeEvent(value, DIRECTORY, vi.t, vi.format, managerCan).target.href
  expect(forManager(event('package.importConfirmed', { type: 'package', id: 'PK-0001' }))).toBe('/kien-hang?q=PK-0001')
  expect(forManager(event('packageType.created', { type: 'packageType', id: 'PT-001' }))).toBeNull()
})

test('một đợt thêm kiện vào kho kiện: số kiện, loại kiện và kiện cuối của đợt', () => {
  const registered = event('package.created', { type: 'package', id: 'PK-0001' }, { count: 12, packageTypeId: 'PT-001', lastPackageId: 'PK-0012' })
  expect(describe(registered)).toMatchObject({ action: 'Thêm kiện vào kho kiện', details: 'Số kiện: 12 · Loại kiện: PT-001 · Đến kiện: PK-0012' })
  expect(describe(registered, en).details).toBe('Packages: 12 · Package type: PT-001 · Through package: PK-0012')
  const imported = event('package.importConfirmed', { type: 'package', id: 'PK-0049' }, { count: 40, lastPackageId: 'PK-0088' })
  expect(describe(imported)).toMatchObject({ action: 'Nhập file vào kho kiện', details: 'Số kiện: 40 · Đến kiện: PK-0088' })
  expect(describe(imported, en).action).toBe('Imported a file into the package pool')
  // Kho kiện (FE-3b-01): trạng thái và cờ là mã của kho, nhật ký dịch qua nhánh `common`
  const moved = event('package.statusChanged', { type: 'package', id: 'PK-0049' }, { before: 'IN_TRANSIT', after: 'RETURNED' })
  expect(describe(moved)).toMatchObject({ action: 'Chuyển trạng thái kiện', details: 'Trước: Đang vận chuyển · Sau: Hoàn trả' })
  expect(describe(moved, en).details).toBe('Before: In transit · After: Returned')
  const cleared = event('package.flagCleared', { type: 'package', id: 'PK-0063' }, { flag: 'NOT_FOUND' })
  expect(describe(cleared)).toMatchObject({ action: 'Gỡ cờ kiện', details: 'Cờ: Không tìm thấy' })
  expect(describe(cleared, en)).toMatchObject({ action: 'Cleared package flag', details: 'Flag: Not found' })
})
