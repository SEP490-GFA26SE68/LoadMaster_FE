import { getMockDb, type Company, type PackageType, type ReceiptResult, type RegisteredPackage, type Shipment } from '@/lib/mock-db'

/**
 * Lớp dữ liệu nhận hàng của công ty logistics (luồng 1 Review 1, LM-104): lô đã bàn giao cho công ty của người đăng nhập, quét QR
 * từng kiện để xác nhận. Kho chặn người của công ty khác (`RECEIVING_FORBIDDEN`) như server sẽ làm.
 */

export type IncomingPackage = { readonly package: RegisteredPackage; readonly type: PackageType | undefined }

/** Một lô trên màn nhận hàng: kiện còn chờ quét và kiện đã nhận. */
export type IncomingShipment = {
  readonly shipment: Shipment
  readonly manufacturer: Company | undefined
  readonly pending: readonly IncomingPackage[]
  readonly received: readonly IncomingPackage[]
}

/** Lô đã bàn giao (chưa nhận đủ trước, rồi đã nhận đủ), mới nhất trước trong mỗi nhóm. Lô nháp không bao giờ có ở đây. */
export async function fetchIncomingShipments(): Promise<IncomingShipment[]> {
  const db = getMockDb()
  const [shipments, packages, types, companies] = await Promise.all([db.listShipments(), db.listRegisteredPackages(), db.listPackageTypes(), db.listCompanies()])
  const packageById = new Map(packages.map((pkg) => [pkg.id, pkg]))
  const typeById = new Map(types.map((type) => [type.id, type]))
  const companyById = new Map(companies.map((company) => [company.id, company]))
  const rows = shipments
    .filter((shipment) => shipment.status !== 'draft')
    .map((shipment): IncomingShipment => {
      const items = shipment.packageIds.flatMap((id) => {
        const pkg = packageById.get(id)
        return pkg ? [{ package: pkg, type: typeById.get(pkg.packageTypeId) }] : []
      })
      return {
        shipment,
        manufacturer: companyById.get(shipment.manufacturerId),
        pending: items.filter((item) => item.package.status === 'in_shipment'),
        received: items.filter((item) => item.package.status !== 'in_shipment'),
      }
    })
  return [...rows.filter((row) => row.pending.length > 0), ...rows.filter((row) => row.pending.length === 0)]
}

/** Quét (hoặc gõ) mã QR của một kiện để nhận. */
export function receivePackageByQr(token: string): Promise<ReceiptResult> {
  return getMockDb().receivePackageByQr(token)
}
