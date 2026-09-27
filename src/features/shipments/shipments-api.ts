import {
  getMockDb,
  type Company,
  type PackageType,
  type RegisteredPackage,
  type Shipment,
  type ShipmentChanges,
  type ShipmentInput,
} from '@/lib/mock-db'

/**
 * Lớp dữ liệu lô hàng (luồng 1 Review 1, LM-104): nhà sản xuất gom kiện đã đăng ký thành lô, chọn công ty logistics nhận, bàn giao.
 * Nối backend thật chỉ thay thân hàm. Kho lọc theo người đăng nhập.
 */

/** Một dòng danh sách lô: lô kèm tên hai công ty và số kiện đã nhận. */
export type ShipmentRow = {
  readonly shipment: Shipment
  readonly manufacturer: Company | undefined
  readonly logistics: Company | undefined
  readonly receivedCount: number
}

export async function fetchShipments(): Promise<ShipmentRow[]> {
  const db = getMockDb()
  const [shipments, companies] = await Promise.all([db.listShipments(), db.listCompanies()])
  const companyById = new Map(companies.map((company) => [company.id, company]))
  return shipments.map((shipment) => ({
    shipment,
    manufacturer: companyById.get(shipment.manufacturerId),
    logistics: companyById.get(shipment.logisticsCompanyId),
    receivedCount: shipment.receipts.length,
  }))
}

/** Chi tiết lô `/lo-hang/:id`: kiện trong lô (theo thứ tự lô) kèm loại kiện. */
export type ShipmentDetail = ShipmentRow & {
  readonly packages: readonly { readonly package: RegisteredPackage; readonly type: PackageType | undefined }[]
}

export async function fetchShipment(id: string): Promise<ShipmentDetail> {
  const db = getMockDb()
  const [shipment, companies, packages, types] = await Promise.all([db.getShipment(id), db.listCompanies(), db.listRegisteredPackages(), db.listPackageTypes()])
  const companyById = new Map(companies.map((company) => [company.id, company]))
  const packageById = new Map(packages.map((pkg) => [pkg.id, pkg]))
  const typeById = new Map(types.map((type) => [type.id, type]))
  return {
    shipment,
    manufacturer: companyById.get(shipment.manufacturerId),
    logistics: companyById.get(shipment.logisticsCompanyId),
    receivedCount: shipment.receipts.length,
    packages: shipment.packageIds.flatMap((packageId) => {
      const pkg = packageById.get(packageId)
      return pkg ? [{ package: pkg, type: typeById.get(pkg.packageTypeId) }] : []
    }),
  }
}

/** Kiện còn đưa vào lô được: đã đăng ký, chưa ở lô nào (kể cả lô nháp). */
export async function fetchShippablePackages(): Promise<RegisteredPackage[]> {
  const packages = await getMockDb().listRegisteredPackages()
  return packages.filter((pkg) => pkg.status === 'registered' && pkg.shipmentId === undefined)
}

export function createShipment(input: ShipmentInput): Promise<Shipment> {
  return getMockDb().createShipment(input)
}

export function updateShipment(id: string, changes: ShipmentChanges): Promise<Shipment> {
  return getMockDb().updateShipment(id, changes)
}

export function deleteShipment(id: string): Promise<void> {
  return getMockDb().deleteShipment(id)
}

export function handOverShipment(id: string): Promise<Shipment> {
  return getMockDb().handOverShipment(id)
}
