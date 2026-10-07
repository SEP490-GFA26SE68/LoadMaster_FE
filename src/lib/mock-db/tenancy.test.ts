import { beforeAll, describe, expect, test } from 'vitest'
import type { VehicleConfig } from '@/domain/models'
import { createMockDb, type MockDb, type PackageInput, type PackageTypeInput, type Revision, type VehicleTypeInput } from '@/lib/mock-db'

/**
 * Cách ly dữ liệu theo công ty ở tầng kho (D-64, FE-0-02): đăng nhập là người của một công ty thì **không hàm công khai nào** của kho
 * trả về hay sửa bản ghi của công ty kia; phiên nền tảng bị mọi hàm dữ liệu vận hành từ chối.
 *
 * Bảng `PROBES` phải có **mọi** hàm công khai của kho: thêm hàm vào kho mà không khai ở đây thì test đầu tiên đỏ (và `tsc -b` báo
 * thiếu khoá), nên hàm mới không lọt khỏi luật công ty. Mã bản ghi của từng công ty chép tay từ `seed-*.ts`, không lấy qua bộ lọc
 * của kho.
 */

type Company = {
  id: string
  /** Điều phối viên của công ty: phiên dùng để gọi kho. */
  viewer: string
  driver: string
  users: string[]
  /** Tài khoản nền tảng đã làm việc trên tài khoản của công ty trong seed: nhật ký của công ty đọc được tên họ (FE-0-08). */
  platformActors: string[]
  vehicles: string[]
  /** Xe đã gắn loại xe. */
  typedVehicles: string[]
  vehicleTypes: string[]
  packageTypes: string[]
  packages: string[]
  /** Mới nhất trước, như `listDeliveryRequirements`. */
  requirements: string[]
  trips: string[]
  /** Chuyến Đang vận chuyển: các chuyến có vị trí xe để giám sát (FE-6-08). */
  inTransit: string[]
  /** Chuyến đang lập kế hoạch đã có bản duyệt `revision`, và một chuyến nháp có điểm giao `STOP-01`. */
  trip: string
  revision: string
  draftTrip: string
  /** Kiện đã ở kho, chưa thuộc yêu cầu giao nào. */
  freePackage: string
}

const range = (prefix: string, from: number, to: number, digits: number) =>
  Array.from({ length: to - from + 1 }, (_, index) => `${prefix}${String(from + index).padStart(digits, '0')}`)

const LONG_BINH: Company = {
  id: 'LOG-001',
  viewer: 'US-0001',
  driver: 'US-0004',
  users: ['US-0001', 'US-0002', 'US-0003', 'US-0004', 'US-0006', 'US-0007', 'US-0008', 'US-0009', 'US-0010', 'US-0011', 'US-0012', 'US-LB-01'],
  platformActors: ['US-0005'],
  vehicles: range('VEHICLE-', 1, 8, 3),
  typedVehicles: range('VEHICLE-', 1, 7, 3),
  vehicleTypes: range('VT-', 1, 7, 3),
  packageTypes: range('PT-', 1, 8, 3),
  // 2.863 kiện của 15 chuyến seed (nguồn `TRIP`, FE-3b-07) đứng trước 88 kiện có từ trước
  packages: [...range('PK-T', 1, 2863, 5), ...range('PK-', 1, 88, 4)],
  requirements: ['REQ-006', 'REQ-005', 'REQ-004', 'REQ-003', 'REQ-002', 'REQ-001'],
  trips: ['TRIP-2026-0914', ...range('TRIP-', 1, 14, 3)],
  inTransit: ['TRIP-009'],
  trip: 'TRIP-2026-0914',
  revision: 'REV-002',
  draftTrip: 'TRIP-014',
  freePackage: 'PK-0023',
}

const PHUONG_NAM: Company = {
  id: 'LOG-002',
  viewer: 'US-PN-03',
  driver: 'US-PN-04',
  users: ['US-0015', 'US-PN-01', 'US-PN-02', 'US-PN-03', 'US-PN-04'],
  platformActors: [],
  vehicles: ['VEHICLE-PN-01', 'VEHICLE-PN-02'],
  typedVehicles: ['VEHICLE-PN-01'],
  vehicleTypes: ['VT-PN-01'],
  packageTypes: ['PT-PN-01', 'PT-PN-02'],
  packages: [...range('PK-PN-T', 1, 70, 4), ...range('PK-PN-', 1, 10, 4)],
  requirements: ['REQ-PN-001'],
  trips: ['TRIP-PN-001', 'TRIP-PN-002'],
  inTransit: [],
  trip: 'TRIP-PN-001',
  revision: 'REV-PN-002',
  draftTrip: 'TRIP-PN-002',
  freePackage: 'PK-PN-0005',
}

const PLATFORM_USERS = ['US-0005', 'US-NT-01', 'US-NT-02']
const SYSTEM_ADMIN = 'US-0005'
const NOW = new Date('2026-09-14T05:00:00.000Z')

/** Bản ghi của công ty kia đọc sẵn khi kho chưa có phiên (không lọc): đầu vào cho các lệnh ghi cần cả object. */
type Foreign = { vehicle: VehicleConfig; revision: Revision; qrToken: string }
type Ctx = { db: MockDb; own: Company; other: Company; foreign: Foreign }
type Call = (ctx: Ctx) => Promise<unknown>

type Probe =
  /** Phiên và tài khoản của chính người gọi: không nhận mã bản ghi nào của công ty. */
  | { scope: 'session' }
  | {
      /** `operational`: phiên nền tảng bị từ chối. `directory` (người dùng, nhật ký, công ty): phiên nền tảng thấy hết. */
      scope: 'operational' | 'directory'
      /** Hàm liệt kê: trả đúng các mã của công ty mình. */
      list?: { call: Call; ids: (result: never) => string[]; own: (company: Company) => string[]; all?: string[] }
      /** Đọc bản ghi của công ty kia: `NOT_FOUND` (tra mã QR: `QR_UNKNOWN`). */
      hidden?: Call
      hiddenCode?: 'QR_UNKNOWN'
      /** Ghi vào, hoặc tham chiếu tới, bản ghi của công ty kia: `FORBIDDEN_COMPANY`. */
      forbidden?: Record<string, Call>
      /** Tạo bản ghi mới: thuộc công ty mình, công ty kia không thấy. */
      creates?: Call
    }

const TYPE: PackageTypeInput = {
  name: 'Thùng nước tăng lực 24 lon', lengthCm: 40, widthCm: 27, heightCm: 13, weightKg: 8.6, fragilityLevel: 'NONE',
  allowedOrientations: ['LWH', 'WLH'], keepUpright: true, stackable: true, maxStackCount: 6, maxTopLoadKg: 45,
}
const VEHICLE_TYPE: VehicleTypeInput = { name: 'Xe tải 1,9 tấn thùng 3,6 m', cargoLengthCm: 360, cargoWidthCm: 170, cargoHeightCm: 170, payloadKg: 1900 }
const PACKAGE: PackageInput = { lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 18, handlingClass: 'STANDARD', destination: 'KCN Hoà Khánh, Q. Liên Chiểu, Đà Nẵng' }
const STOP = { id: 'STOP-01', name: 'Kho Bách Hoá Xanh Dĩ An', address: '215 Quốc lộ 1K, P. Đông Hoà, Dĩ An' }
const newTrip = (vehicleId: string, driverId: string | null = null) => ({ name: 'Tuyến thử cách ly', vehicleId, driverId, scheduledDate: '2026-09-15', packages: [], stops: [STOP] })
const newUser = (companyId?: string) => ({ fullName: 'Phan Thị Yến', email: 'yen.phan@loadmaster.vn', phone: '0915 678 903', role: 'driver' as const, depot: 'Kho Long Bình', ...(companyId ? { companyId } : {}) })
/** Hạn sau `NOW` hai ngày. */
const requirement = (packageIds: string[]) => ({
  destinationName: 'Siêu thị Co.opmart Biên Hoà', address: '121 Phạm Văn Thuận, Biên Hoà', deadline: '2026-09-16T10:00:00.000Z', priority: 'NORMAL' as const, packageIds,
})
const PICKUP_INPUT = {
  pickup: { name: 'Xưởng may Hoàng Gia', address: 'Đường số 4, KCN VSIP 1, Thuận An', lat: 10.928, lng: 106.712 },
  delivery: { name: 'Bếp ăn KCN Sóng Thần', address: '12 Đường số 6, KCN Sóng Thần 1, Dĩ An', lat: 10.893, lng: 106.75 },
  packages: [{ packageCode: 'HG-0412', lengthCm: 60, widthCm: 40, heightCm: 40, weightKg: 12, handlingClass: 'STANDARD' as const }],
}
const idsOf = (rows: { id: string }[]) => rows.map((row) => row.id)
const vehicleIdsOf = (rows: { vehicleId: string }[]) => rows.map((row) => row.vehicleId)

/** Mọi hàm ghi tiến độ của chuyến: gọi trên chuyến của công ty kia. */
const onForeignTrip = (call: (db: MockDb, tripId: string, foreign: Foreign) => Promise<unknown>): Probe => ({
  scope: 'operational',
  forbidden: { 'chuyến của công ty kia': ({ db, other, foreign }) => call(db, other.trip, foreign) },
})

const PROBES = {
  listVehicles: { scope: 'operational', list: { call: ({ db }) => db.listVehicles(), ids: idsOf, own: (c) => c.vehicles } },
  getVehicle: { scope: 'operational', hidden: ({ db, other }) => db.getVehicle(other.vehicles[0]!) },
  createVehicle: { scope: 'operational', creates: ({ db, foreign: { vehicle: { id: _id, ...vehicle } } }) => db.createVehicle({ ...vehicle, name: 'Xe mới' }) },
  updateVehicle: { scope: 'operational', forbidden: { 'xe của công ty kia': ({ db, foreign }) => db.updateVehicle({ ...foreign.vehicle, name: 'Đổi tên' }) } },
  deleteVehicle: { scope: 'operational', forbidden: { 'xe của công ty kia': ({ db, other }) => db.deleteVehicle(other.vehicles[1]!) } },
  listVehicleStates: { scope: 'operational', list: { call: ({ db }) => db.listVehicleStates(), ids: vehicleIdsOf, own: (c) => c.vehicles } },
  setVehicleMaintenance: { scope: 'operational', forbidden: { 'xe của công ty kia': ({ db, other }) => db.setVehicleMaintenance(other.vehicles[0]!, 'Thay lốp') } },

  listTrips: { scope: 'operational', list: { call: ({ db }) => db.listTrips(), ids: idsOf, own: (c) => c.trips } },
  getTrip: { scope: 'operational', hidden: ({ db, other }) => db.getTrip(other.trip) },
  createTrip: {
    scope: 'operational',
    creates: ({ db, own }) => db.createTrip(newTrip(own.vehicles[0]!, own.driver)),
    forbidden: {
      'xe của công ty kia': ({ db, other }) => db.createTrip(newTrip(other.vehicles[0]!)),
      'tài xế của công ty kia': ({ db, own, other }) => db.createTrip(newTrip(own.vehicles[0]!, other.driver)),
    },
  },
  updateTrip: {
    scope: 'operational',
    forbidden: {
      'chuyến của công ty kia': ({ db, other }) => db.updateTrip(other.draftTrip, { name: 'Đổi tên' }),
      'xe của công ty kia': ({ db, own, other }) => db.updateTrip(own.draftTrip, { vehicleId: other.vehicles[0]! }),
      'tài xế của công ty kia': ({ db, own, other }) => db.updateTrip(own.draftTrip, { driverId: other.driver }),
    },
  },
  cancelTrip: onForeignTrip((db, tripId) => db.cancelTrip(tripId, 'Khách hoãn')),
  changeTripVehicle: {
    scope: 'operational',
    forbidden: {
      'chuyến của công ty kia': ({ db, own, other }) => db.changeTripVehicle(other.trip, own.vehicles[0]!),
      'xe của công ty kia': ({ db, own, other }) => db.changeTripVehicle(own.trip, other.vehicles[0]!),
    },
  },

  listRevisions: { scope: 'operational', hidden: ({ db, other }) => db.listRevisions(other.trip) },
  getRevision: { scope: 'operational', hidden: ({ db, other }) => db.getRevision(other.revision) },
  addRevision: onForeignTrip((db, tripId, { revision }) => db.addRevision({ tripId, request: revision.request, result: revision.result })),
  saveOptimizationRun: onForeignTrip((db, tripId, { revision }) =>
    db.saveOptimizationRun({ tripId, request: revision.request, jobId: revision.jobId, plans: [{ objective: 'MAX_VOLUME', result: revision.result }] })),
  approveRevision: { scope: 'operational', forbidden: { 'phương án của công ty kia': ({ db, other }) => db.approveRevision(other.revision, []) } },
  listOptimizationRuns: { scope: 'operational', hidden: ({ db, other }) => db.listOptimizationRuns(other.trip) },
  recordFailedRun: onForeignTrip((db, tripId) => db.recordFailedRun(tripId, { failureCode: 'SERVICE_UNAVAILABLE' })),

  startLoading: onForeignTrip((db, tripId) => db.startLoading(tripId)),
  completeLoading: onForeignTrip((db, tripId) => db.completeLoading(tripId)),
  startDelivery: onForeignTrip((db, tripId) => db.startDelivery(tripId)),
  arriveAtStop: onForeignTrip((db, tripId) => db.arriveAtStop(tripId, 1)),
  reportDeliveryIssue: onForeignTrip((db, tripId) => db.reportDeliveryIssue(tripId, { stopNumber: 1, kind: 'damaged', note: 'Móp góc' })),
  completeStop: onForeignTrip((db, tripId) => db.completeStop(tripId, 1)),
  listTripLabels: { scope: 'operational', hidden: ({ db, other }) => db.listTripLabels(other.trip) },
  getTripReadiness: { scope: 'operational', hidden: ({ db, other }) => db.getTripReadiness(other.trip) },
  confirmStagingByQr: onForeignTrip((db, tripId, { qrToken }) => db.confirmStagingByQr(tripId, qrToken)),
  confirmStagingManually: onForeignTrip((db, tripId) => db.confirmStagingManually(tripId, { packageInstanceId: 'PKG-001-01', reason: 'LABEL_DAMAGED' })),
  reportStagingShortage: onForeignTrip((db, tripId) => db.reportStagingShortage(tripId, 'PKG-001-01')),
  resolveStagingShortage: onForeignTrip((db, tripId) => db.resolveStagingShortage(tripId, 'PKG-001-01', 'KEEP_SEARCHING')),
  reportDamagedPackage: onForeignTrip((db, tripId) => db.reportDamagedPackage(tripId, 'PKG-001-01')),
  confirmLoadingByQr: onForeignTrip((db, tripId, { qrToken }) => db.confirmLoadingByQr(tripId, qrToken)),
  recordSeal: onForeignTrip((db, tripId) => db.recordSeal(tripId, 'SEAL-0914')),
  confirmUnloadByQr: onForeignTrip((db, tripId, { qrToken }) => db.confirmUnloadByQr(tripId, 1, qrToken)),
  confirmLoadingManually: onForeignTrip((db, tripId) => db.confirmLoadingManually(tripId, { packageInstanceId: 'PKG-001-01', reason: 'LABEL_DAMAGED' })),
  confirmUnloadManually: onForeignTrip((db, tripId) => db.confirmUnloadManually(tripId, 1, { packageInstanceId: 'PKG-001-01', reason: 'QR_UNREADABLE' })),
  approveManualConfirmation: onForeignTrip((db, tripId) => db.approveManualConfirmation(tripId, 'VF-001')),
  rejectManualConfirmation: onForeignTrip((db, tripId) => db.rejectManualConfirmation(tripId, 'VF-001', 'Sai kiện')),
  postDriverLocation: onForeignTrip((db, tripId) => db.postDriverLocation(tripId, { lat: 10.9294, lng: 106.8747 })),
  setDriverGps: onForeignTrip((db, tripId) => db.setDriverGps(tripId, true)),
  getLatestLocation: { scope: 'operational', hidden: ({ db, other }) => db.getLatestLocation(other.trip) },
  getLocationHistory: { scope: 'operational', hidden: ({ db, other }) => db.getLocationHistory(other.trip) },
  getTripMonitoring: { scope: 'operational', hidden: ({ db, other }) => db.getTripMonitoring(other.trip) },
  listTripMonitoring: { scope: 'operational', list: { call: ({ db }) => db.listTripMonitoring(), ids: (rows: { tripId: string }[]) => rows.map((row) => row.tripId), own: (c) => c.inTransit } },
  // Sự cố cấp chuyến, tuyến thay thế, gia hạn (FE-6-11, FE-6-12): seed không có sự cố nào
  reportTripException: onForeignTrip((db, tripId) => db.reportTripException(tripId, { type: 'TRAFFIC', description: 'Kẹt xe ở ngã tư Vũng Tàu', delayMinutes: 20 })),
  listTripExceptions: { scope: 'operational', hidden: ({ db, other }) => db.listTripExceptions(other.trip) },
  escalateTripException: onForeignTrip((db, tripId) => db.escalateTripException(tripId, 'EXC-001')),
  resolveTripException: onForeignTrip((db, tripId) => db.resolveTripException(tripId, 'EXC-001')),
  requestReroute: onForeignTrip((db, tripId) => db.requestReroute(tripId)),
  confirmReroute: onForeignTrip((db, tripId) => db.confirmReroute(tripId, 0)),
  listTripReroutes: { scope: 'operational', hidden: ({ db, other }) => db.listTripReroutes(other.trip) },
  renegotiateDeadline: onForeignTrip((db, tripId) => db.renegotiateDeadline(tripId, 'EXC-001', { requirementId: 'REQ-001', deadline: '2026-09-16T10:00:00.000Z', contactNote: 'Đã gọi khách' })),

  // Yêu cầu nhận dọc đường (FE-7-01): lọc qua chuyến, như mọi hàm ghi tiến độ của chuyến
  listPickupRequests: { scope: 'operational', hidden: ({ db, other }) => db.listPickupRequests(other.trip) },
  getPickupRequest: { scope: 'operational', hidden: ({ db, other }) => db.getPickupRequest(other.trip, 'PKR-001') },
  createPickupRequest: onForeignTrip((db, tripId) => db.createPickupRequest(tripId, PICKUP_INPUT)),
  updatePickupStatus: onForeignTrip((db, tripId) => db.updatePickupStatus(tripId, 'PKR-001', 'VALIDATED')),

  authenticate: { scope: 'session' },
  signOut: { scope: 'session' },
  restoreSession: { scope: 'session' },
  sessionUser: { scope: 'session' },
  changePassword: { scope: 'session' },
  updateProfile: { scope: 'session' },
  listUsers: { scope: 'directory', list: { call: ({ db }) => db.listUsers(), ids: idsOf, own: (c) => c.users, all: [...LONG_BINH.users, ...PHUONG_NAM.users, ...PLATFORM_USERS] } },
  getUser: { scope: 'directory', hidden: ({ db, other }) => db.getUser(other.driver) },
  createUser: {
    scope: 'directory',
    creates: ({ db }) => db.createUser(newUser()),
    forbidden: { 'tài khoản cho công ty kia': ({ db, other }) => db.createUser(newUser(other.id)) },
  },
  updateUser: { scope: 'directory', forbidden: { 'người của công ty kia': ({ db, other }) => db.updateUser(other.driver, { phone: '0900 000 000' }) } },
  setUserStatus: { scope: 'directory', forbidden: { 'người của công ty kia': ({ db, other }) => db.setUserStatus(other.driver, 'suspended') } },
  deleteUser: { scope: 'directory', forbidden: { 'người của công ty kia': ({ db, other }) => db.deleteUser(other.users[0]!) } },
  resetPassword: { scope: 'directory', forbidden: { 'người của công ty kia': ({ db, other }) => db.resetPassword(other.driver) } },
  // Số sự kiện kiểm riêng ở test "nhật ký" bên dưới: ở đây chỉ so công ty của người làm
  listEvents: { scope: 'directory' },
  listAuditNames: {
    scope: 'directory',
    list: {
      call: ({ db }) => db.listAuditNames(),
      ids: ({ users, trips, vehicles }: { users: { id: string }[]; trips: { id: string }[]; vehicles: { id: string }[] }) => [...idsOf(users), ...idsOf(trips), ...idsOf(vehicles)],
      own: (c) => [...c.users, ...c.platformActors, ...c.trips, ...c.vehicles],
    },
  },
  listCompanies: { scope: 'directory', list: { call: ({ db }) => db.listCompanies(), ids: idsOf, own: (c) => [c.id], all: ['LOG-001', 'LOG-002'] } },

  listPackageTypes: { scope: 'operational', list: { call: ({ db }) => db.listPackageTypes(), ids: idsOf, own: (c) => c.packageTypes } },
  getPackageType: { scope: 'operational', hidden: ({ db, other }) => db.getPackageType(other.packageTypes[0]!) },
  createPackageType: { scope: 'operational', creates: ({ db }) => db.createPackageType(TYPE) },
  updatePackageType: { scope: 'operational', forbidden: { 'loại kiện của công ty kia': ({ db, other }) => db.updatePackageType(other.packageTypes[0]!, TYPE) } },
  deletePackageType: { scope: 'operational', forbidden: { 'loại kiện của công ty kia': ({ db, other }) => db.deletePackageType(other.packageTypes[1]!) } },

  listPackages: { scope: 'operational', list: { call: ({ db }) => db.listPackages(), ids: idsOf, own: (c) => c.packages } },
  getPackage: { scope: 'operational', hidden: ({ db, other }) => db.getPackage(other.packages[0]!) },
  findPackageByQr: { scope: 'operational', hidden: ({ db, foreign }) => db.findPackageByQr(foreign.qrToken), hiddenCode: 'QR_UNKNOWN' },
  lookupPackages: { scope: 'operational', hidden: ({ db, other }) => db.lookupPackages(other.freePackage), hiddenCode: 'QR_UNKNOWN' },
  reportPackageFound: { scope: 'operational', hidden: ({ db, foreign }) => db.reportPackageFound(foreign.qrToken), hiddenCode: 'QR_UNKNOWN' },
  createPackage: {
    scope: 'operational',
    creates: ({ db, own }) => db.createPackage({ ...PACKAGE, packageTypeId: own.packageTypes[0]! }),
    forbidden: { 'loại kiện của công ty kia': ({ db, other }) => db.createPackage({ ...PACKAGE, packageTypeId: other.packageTypes[0]! }) },
  },
  createPackages: {
    scope: 'operational',
    creates: ({ db, own }) => db.createPackages([PACKAGE, { ...PACKAGE, packageTypeId: own.packageTypes[1]! }], 'IMPORT'),
    forbidden: {
      'một dòng dùng loại kiện của công ty kia': ({ db, own, other }) =>
        db.createPackages([{ ...PACKAGE, packageTypeId: own.packageTypes[0]! }, { ...PACKAGE, packageTypeId: other.packageTypes[0]! }]),
    },
  },
  updatePackage: {
    scope: 'operational',
    forbidden: {
      'kiện của công ty kia': ({ db, other }) => db.updatePackage(other.freePackage, { destination: 'KCN Phú Bài, Huế' }),
      'loại kiện của công ty kia': ({ db, own, other }) => db.updatePackage(own.freePackage, { packageTypeId: other.packageTypes[0]! }),
    },
  },
  updatePackageStatus: { scope: 'operational', forbidden: { 'kiện của công ty kia': ({ db, other }) => db.updatePackageStatus(other.freePackage, 'ASSIGNED') } },
  flagPackage: { scope: 'operational', forbidden: { 'kiện của công ty kia': ({ db, other }) => db.flagPackage(other.freePackage, 'DAMAGED') } },
  clearPackageFlag: { scope: 'operational', forbidden: { 'kiện của công ty kia': ({ db, other }) => db.clearPackageFlag(other.freePackage, 'DAMAGED') } },

  listDeliveryRequirements: { scope: 'operational', list: { call: ({ db }) => db.listDeliveryRequirements(), ids: idsOf, own: (c) => c.requirements } },
  getDeliveryRequirement: { scope: 'operational', hidden: ({ db, other }) => db.getDeliveryRequirement(other.requirements[0]!) },
  createDeliveryRequirement: {
    scope: 'operational',
    creates: ({ db, own }) => db.createDeliveryRequirement(requirement([own.freePackage])),
    forbidden: { 'kiện của công ty kia': ({ db, other }) => db.createDeliveryRequirement(requirement([other.freePackage])) },
  },
  updateDeliveryRequirement: {
    scope: 'operational',
    forbidden: {
      'yêu cầu của công ty kia': ({ db, other }) => db.updateDeliveryRequirement(other.requirements[0]!, { note: 'Giao giờ hành chính' }),
      'kiện của công ty kia': ({ db, own, other }) => db.updateDeliveryRequirement(own.requirements[0]!, { packageIds: [other.freePackage] }),
    },
  },
  deleteDeliveryRequirement: { scope: 'operational', forbidden: { 'yêu cầu của công ty kia': ({ db, other }) => db.deleteDeliveryRequirement(other.requirements[0]!) } },
  assignDeliveryRequirement: {
    scope: 'operational',
    forbidden: {
      'yêu cầu của công ty kia': ({ db, own, other }) => db.assignDeliveryRequirement(other.requirements[0]!, own.draftTrip),
      'chuyến của công ty kia': ({ db, own, other }) => db.assignDeliveryRequirement(own.requirements[0]!, other.draftTrip),
    },
  },
  unassignDeliveryRequirement: { scope: 'operational', forbidden: { 'yêu cầu của công ty kia': ({ db, other }) => db.unassignDeliveryRequirement(other.requirements[0]!) } },
  listTripPackages: { scope: 'operational', hidden: ({ db, other }) => db.listTripPackages(other.trip) },
  addTripPackages: {
    scope: 'operational',
    forbidden: {
      'chuyến của công ty kia': ({ db, own, other }) => db.addTripPackages(other.draftTrip, [own.freePackage], { stopId: 'STOP-01' }),
      'kiện của công ty kia': ({ db, own, other }) => db.addTripPackages(own.draftTrip, [other.freePackage], { stopId: 'STOP-01' }),
    },
  },
  getTripSegregation: { scope: 'operational', hidden: ({ db, other }) => db.getTripSegregation(other.trip) },
  overrideTripSegregation: onForeignTrip((db, tripId) => db.overrideTripSegregation(tripId, 'Khách gom chung một xe')),
  optimizeTripRoute: onForeignTrip((db, tripId) => db.optimizeTripRoute(tripId)),
  getTripEta: { scope: 'operational', hidden: ({ db, other }) => db.getTripEta(other.trip) },
  removeTripPackage: {
    scope: 'operational',
    forbidden: {
      'chuyến của công ty kia': ({ db, own, other }) => db.removeTripPackage(other.draftTrip, own.freePackage),
      'kiện của công ty kia': ({ db, own, other }) => db.removeTripPackage(own.draftTrip, other.freePackage),
    },
  },

  listVehicleTypes: { scope: 'operational', list: { call: ({ db }) => db.listVehicleTypes(), ids: idsOf, own: (c) => c.vehicleTypes } },
  getVehicleType: { scope: 'operational', hidden: ({ db, other }) => db.getVehicleType(other.vehicleTypes[0]!) },
  createVehicleType: { scope: 'operational', creates: ({ db }) => db.createVehicleType(VEHICLE_TYPE) },
  updateVehicleType: { scope: 'operational', forbidden: { 'loại xe của công ty kia': ({ db, other }) => db.updateVehicleType(other.vehicleTypes[0]!, VEHICLE_TYPE) } },
  deleteVehicleType: { scope: 'operational', forbidden: { 'loại xe của công ty kia': ({ db, other }) => db.deleteVehicleType(other.vehicleTypes[0]!) } },
  listVehicleTypeAssignments: { scope: 'operational', list: { call: ({ db }) => db.listVehicleTypeAssignments(), ids: vehicleIdsOf, own: (c) => c.typedVehicles } },
  setVehicleType: {
    scope: 'operational',
    forbidden: {
      'xe của công ty kia': ({ db, own, other }) => db.setVehicleType(other.vehicles[0]!, own.vehicleTypes[0]!),
      'loại xe của công ty kia': ({ db, own, other }) => db.setVehicleType(own.vehicles[0]!, other.vehicleTypes[0]!),
    },
  },
} satisfies Record<keyof MockDb, Probe>

const probes = Object.entries(PROBES) as [keyof MockDb, Probe][]
const scoped = probes.flatMap(([name, probe]) => (probe.scope === 'session' ? [] : [{ name, probe }]))
const lists = scoped.flatMap(({ name, probe }) => (probe.list ? [{ name, scope: probe.scope, list: probe.list }] : []))
const hidden = scoped.flatMap(({ name, probe }) => (probe.hidden ? [{ name, call: probe.hidden, code: probe.hiddenCode ?? 'NOT_FOUND' }] : []))
const forbidden = scoped.flatMap(({ name, probe }) => Object.entries(probe.forbidden ?? {}).map(([what, call]) => ({ name, what, call })))
const creates = scoped.flatMap(({ name, probe }) => (probe.creates ? [{ name, call: probe.creates }] : []))

/** Kho mới, đọc sẵn bản ghi của `other` rồi đặt phiên của `sessionUserId` — `restoreSession` không ghi nhật ký, không đổi dữ liệu. */
async function open(own: Company, other: Company, sessionUserId = own.viewer): Promise<Ctx> {
  const db = createMockDb({ now: () => NOW })
  const foreign = {
    vehicle: await db.getVehicle(other.vehicles[0]!),
    revision: await db.getRevision(other.revision),
    qrToken: (await db.getPackage(other.packages[0]!)).qrToken,
  }
  db.restoreSession(sessionUserId)
  return { db, own, other, foreign }
}

/** Toàn bộ kho, đọc khi không có phiên (không lọc): hai ảnh bằng nhau thì không bản ghi nào của công ty nào bị đổi. */
async function wholeStore(db: MockDb) {
  const session = db.sessionUser()?.id ?? null
  db.restoreSession(null)
  const trips = await db.listTrips()
  const snapshot = {
    vehicles: await db.listVehicles(), states: await db.listVehicleStates(), trips,
    revisions: await Promise.all(trips.map((trip) => db.listRevisions(trip.id))),
    runs: await Promise.all(trips.map((trip) => db.listOptimizationRuns(trip.id))),
    users: await db.listUsers(), events: await db.listEvents(), packageTypes: await db.listPackageTypes(),
    packages: await db.listPackages(), requirements: await db.listDeliveryRequirements(), vehicleTypes: await db.listVehicleTypes(),
    assignments: await db.listVehicleTypeAssignments(), companies: await db.listCompanies(),
  }
  db.restoreSession(session)
  return snapshot
}

test('every public function of the store is classified in PROBES, and every classified one probes something', () => {
  expect(Object.keys(createMockDb()).toSorted()).toStrictEqual(Object.keys(PROBES).toSorted())
  const unprobed = scoped.filter(({ name, probe }) => name !== 'listEvents' && !probe.list && !probe.hidden && !probe.forbidden && !probe.creates)
  expect(unprobed.map(({ name }) => name)).toStrictEqual([])
})

describe.each([
  { own: LONG_BINH, other: PHUONG_NAM },
  { own: PHUONG_NAM, other: LONG_BINH },
])('signed in at $own.id, against the records of $other.id', ({ own, other }) => {
  let ctx: Ctx
  let before: Awaited<ReturnType<typeof wholeStore>>
  beforeAll(async () => {
    ctx = await open(own, other)
    before = await wholeStore(ctx.db)
  })

  test.each(lists)('$name returns exactly the records of the company', async ({ list }) => {
    expect(list.ids((await list.call(ctx)) as never)).toStrictEqual(list.own(own))
  })

  test.each(hidden)('$name does not find a record of the other company', async ({ call, code }) => {
    await expect(call(ctx)).rejects.toMatchObject({ code })
  })

  test.each(forbidden)('$name refuses: $what', async ({ call }) => {
    await expect(call(ctx)).rejects.toMatchObject({ code: 'FORBIDDEN_COMPANY' })
  })

  test('the audit log holds what people of the company did, and what anyone did to an account of the company', async () => {
    const events = await ctx.db.listEvents()
    // Đếm độc lập với bộ lọc của kho (mã người dùng chép tay ở trên): sự kiện seed mà người làm là người của công ty, hoặc đối tượng
    // là tài khoản của công ty — việc quản trị hệ thống làm trên tài khoản đó (FE-0-08)
    const expected = before.events.filter((event) =>
      (event.actorId !== null && own.users.includes(event.actorId)) || (event.target.type === 'user' && own.users.includes(event.target.id)))
    expect(events.map((event) => event.id)).toStrictEqual(expected.map((event) => event.id))
    expect(events.length).toBeGreaterThan(5)
    expect(events.filter((event) => other.trips.includes(event.target.id) || other.users.includes(event.target.id))).toStrictEqual([])
    // Người làm ngoài công ty chỉ có thể là tài khoản nền tảng, và chỉ ở sự kiện về tài khoản của công ty
    const outsiders = events.filter((event) => event.actorId !== null && !own.users.includes(event.actorId))
    expect([...new Set(outsiders.map((event) => event.actorId))]).toStrictEqual(own.platformActors)
    expect(outsiders.length).toBe(own.id === 'LOG-001' ? 4 : 0)
  })

  test('after all of the above nothing in the store has changed: no record written, no event logged', async () => {
    expect(await wholeStore(ctx.db)).toStrictEqual(before)
  })

  test('records created in the session belong to the company: the other company still sees exactly its seed', async () => {
    const created = await open(own, other)
    for (const { call } of creates) await call(created)
    // Người của công ty mình thấy bản ghi mới…
    const mine = { trips: await created.db.listTrips(), vehicles: await created.db.listVehicles(), users: await created.db.listUsers(), requirements: await created.db.listDeliveryRequirements() }
    expect([mine.trips.length, mine.vehicles.length, mine.users.length, mine.requirements.length])
      .toStrictEqual([own.trips.length + 1, own.vehicles.length + 1, own.users.length + 1, own.requirements.length + 1])
    expect(new Set([...mine.trips, ...mine.users, ...mine.requirements].map((record) => record.companyId))).toStrictEqual(new Set([own.id]))
    // …còn công ty kia thấy đúng seed của mình ở mọi hàm liệt kê
    created.db.restoreSession(other.viewer)
    for (const { name, list } of lists) expect(list.ids((await list.call(created)) as never), name).toStrictEqual(list.own(other))
  })
})

describe('signed in as a platform account (system admin)', () => {
  let ctx: Ctx
  let before: Awaited<ReturnType<typeof wholeStore>>
  beforeAll(async () => {
    ctx = await open(LONG_BINH, PHUONG_NAM, SYSTEM_ADMIN)
    before = await wholeStore(ctx.db)
  })

  const operational = scoped.filter(({ probe }) => probe.scope === 'operational').flatMap(({ name, probe }) => [
    ...(probe.list ? [{ name, what: 'liệt kê', call: probe.list.call }] : []),
    ...(probe.hidden ? [{ name, what: 'đọc', call: probe.hidden }] : []),
    ...(probe.creates ? [{ name, what: 'tạo', call: probe.creates }] : []),
    ...Object.entries(probe.forbidden ?? {}).map(([what, call]) => ({ name, what, call })),
  ])

  test.each(operational)('$name is refused ($what): operational data needs a company', async ({ call }) => {
    await expect(call(ctx)).rejects.toMatchObject({ code: 'COMPANY_REQUIRED' })
  })

  test('users, companies and the audit log are not operational data: the platform reads all of them', async () => {
    for (const { name, list } of lists.filter((item) => item.scope === 'directory' && item.list.all)) {
      expect(list.ids((await list.call(ctx)) as never).toSorted(), name).toStrictEqual(list.all?.toSorted())
    }
    expect((await ctx.db.listEvents()).map((event) => event.id)).toStrictEqual(before.events.map((event) => event.id))
    const names = await ctx.db.listAuditNames()
    expect(names.trips.map((trip) => trip.id)).toStrictEqual([...LONG_BINH.trips, ...PHUONG_NAM.trips])
    expect(names.vehicles.map((vehicle) => vehicle.id)).toStrictEqual([...LONG_BINH.vehicles, ...PHUONG_NAM.vehicles])
    expect((await ctx.db.getUser(PHUONG_NAM.driver)).companyId).toBe('LOG-002')
  })

  test('the refused calls changed nothing', async () => {
    expect(await wholeStore(ctx.db)).toStrictEqual(before)
  })
})

test('without a session the store does not filter, and what it creates belongs to the default company LOG-001', async () => {
  const db = createMockDb({ now: () => NOW })
  expect((await db.listTrips()).map((trip) => trip.id)).toStrictEqual([...LONG_BINH.trips, ...PHUONG_NAM.trips])
  expect((await db.getTrip(PHUONG_NAM.trip)).companyId).toBe('LOG-002')
  const trip = await db.createTrip(newTrip('VEHICLE-001', 'US-0004'))
  const type = await db.createPackageType(TYPE)
  const pkg = await db.createPackage({ ...PACKAGE, packageTypeId: type.id })
  expect([trip.companyId, type.companyId, pkg.companyId, (await db.createUser(newUser())).user.companyId]).toStrictEqual(['LOG-001', 'LOG-001', 'LOG-001', 'LOG-001'])
  expect((await db.listEvents())[0]).toMatchObject({ action: 'user.created', actorId: null, companyId: 'LOG-001' })
  // Luật của dữ liệu vẫn giữ khi không có phiên: chuyến của Long Bình không dùng xe của Phương Nam
  await expect(db.createTrip(newTrip('VEHICLE-PN-01'))).rejects.toMatchObject({ code: 'FORBIDDEN_COMPANY', params: { collection: 'vehicles', id: 'VEHICLE-PN-01' } })
  // Phương Nam thấy đúng seed của mình: không bản ghi nào vừa tạo lọt sang
  await db.authenticate('dieuphoi@phuongnam.vn', 'loadmaster')
  expect((await db.listTrips()).map((item) => item.id)).toStrictEqual(PHUONG_NAM.trips)
  expect((await db.listPackageTypes()).map((item) => item.id)).toStrictEqual(PHUONG_NAM.packageTypes)
})

test('audit events carry the company of the session, events about an account the company of that account', async () => {
  const db = createMockDb({ now: () => NOW })
  await db.authenticate('dieuphoi@phuongnam.vn', 'loadmaster')
  await db.setVehicleMaintenance('VEHICLE-PN-02', 'Thay lốp')
  expect((await db.listEvents()).slice(0, 2).map((event) => [event.action, event.actorId, event.companyId])).toStrictEqual([
    ['vehicle.maintenanceOn', 'US-PN-03', 'LOG-002'],
    ['auth.signedIn', 'US-PN-03', 'LOG-002'],
  ])
  await db.authenticate('quantri@loadmaster.vn', 'loadmaster')
  await db.setUserStatus('US-0009', 'suspended')
  await expect(db.authenticate('taixe@phuongnam.vn', 'sai-mat-khau')).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' })
  db.restoreSession(SYSTEM_ADMIN)
  expect((await db.listEvents()).slice(0, 3).map((event) => [event.action, event.actorId, event.companyId])).toStrictEqual([
    // lần đăng nhập sai ghi công ty của tài khoản bị thử, để quản trị công ty đó thấy
    ['auth.signInFailed', SYSTEM_ADMIN, 'LOG-002'],
    // khoá một điều phối viên của Long Bình: sự kiện thuộc Long Bình dù người làm là tài khoản nền tảng (FE-0-08)
    ['user.locked', SYSTEM_ADMIN, 'LOG-001'],
    // việc trên tài khoản nền tảng không thuộc công ty nào
    ['auth.signedIn', SYSTEM_ADMIN, null],
  ])
  // Long Bình không thấy việc của Phương Nam; của tài khoản nền tảng chỉ thấy việc làm trên tài khoản của Long Bình
  db.restoreSession('US-LB-01')
  const seenByLongBinh = await db.listEvents()
  expect(new Set(seenByLongBinh.map((event) => event.companyId))).toStrictEqual(new Set(['LOG-001']))
  expect(seenByLongBinh.filter((event) => event.actorId === 'US-PN-03')).toStrictEqual([])
  expect(seenByLongBinh[0]).toMatchObject({ action: 'user.locked', actorId: SYSTEM_ADMIN, target: { type: 'user', id: 'US-0009' } })
  expect(seenByLongBinh.filter((event) => event.actorId === SYSTEM_ADMIN && event.target.type !== 'user')).toStrictEqual([])
  expect(seenByLongBinh.filter((event) => event.action === 'auth.signInFailed' || event.target.id === SYSTEM_ADMIN)).toStrictEqual([])
})
