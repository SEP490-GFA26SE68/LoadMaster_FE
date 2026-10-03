import { beforeAll, expect, test } from 'vitest'
import { parseCsv } from '@/features/trips/csv'
import { createTranslator } from '@/lib/i18n'
import { getMockDb } from '@/lib/mock-db'
import {
  clearPackageFlag, confirmPackageImport, createPackage, downloadPackageImportTemplate, fetchPackageDetail, fetchPackageLabels, fetchPackages, lookupPackages,
  previewPackageImport, reportPackageFound, scanPackage,
} from './package-pool-api'
import { importTemplateRows } from './package-pool-import'

/**
 * Lớp dữ liệu của kho kiện (FE-3b-03, FE-3b-02) trên kho dùng chung của file, phiên điều phối viên Long Bình; seed có PK-0001…0088.
 * Test chạy theo thứ tự và mỗi test ghi rõ mã kiện nó tạo.
 */
beforeAll(() => {
  getMockDb().restoreSession('US-0001')
})

const HEADER = 'package_code,length,width,height,weight,handling_class,destination,package_type'
const csvFile = (lines: readonly string[], name = 'kien.csv') => new File([[HEADER, ...lines].join('\r\n')], name, { type: 'text/csv' })

test('adding one package gives it a QR code at once; its detail carries the type and a history kept by the store', async () => {
  const created = await createPackage({ packageCode: 'HK-DNG-2609-06', lengthCm: 60, widthCm: 25, heightCm: 60, weightKg: 6, handlingClass: 'FRAGILE', destination: 'KCN Hoà Khánh, Đà Nẵng', packageTypeId: 'PT-006' })
  expect(created).toMatchObject({ id: 'PK-0089', status: 'IMPORTED', source: 'MANUAL', flags: [], companyId: 'LOG-001' })
  expect(created.qrToken).toMatch(/^LM-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/)
  const detail = await fetchPackageDetail('PK-0089')
  expect(detail.type?.name).toBe('Kiện quạt điện')
  expect(detail.history).toStrictEqual([{ at: created.createdAt, actorId: 'US-0001', actorName: 'Nguyễn Thanh Tùng', kind: 'created', source: 'MANUAL' }])
})

test('clearing a flag is written to the history of the package, newest first, with who did it', async () => {
  // PK-0063 mang cờ "Không tìm thấy" từ seed (nhập file 16:20, gắn cờ 17:05 hôm trước ngày neo)
  expect((await clearPackageFlag('PK-0063', 'NOT_FOUND')).flags).toStrictEqual([])
  const { history } = await fetchPackageDetail('PK-0063')
  expect(history.map((entry) => [entry.kind, entry.actorName, 'flag' in entry ? entry.flag : undefined])).toStrictEqual([
    ['flagCleared', 'Nguyễn Thanh Tùng', 'NOT_FOUND'], ['flagged', 'Nguyễn Thanh Tùng', 'NOT_FOUND'], ['created', 'Nguyễn Thanh Tùng', undefined],
  ])
  await expect(clearPackageFlag('PK-0063', 'NOT_FOUND')).rejects.toMatchObject({ code: 'PACKAGE_FLAG_NOT_SET' })
})

test('a file with an error row: the preview names the row, confirming is refused and nothing is created', async () => {
  const before = (await fetchPackages()).length
  const events = (await getMockDb().listEvents()).length
  const preview = await previewPackageImport(csvFile(['DN-0001,60,40,40,18,STANDARD,"KCN Hoà Khánh, Đà Nẵng",', 'DN-0002,60,40,0,18,STANDARD,Huế,', 'DN-0003,60,40,40,18,STANDARD,Huế,']))
  expect([preview.total, preview.valid, preview.errorRows]).toStrictEqual([3, 2, 1])
  expect(preview.rows[1]).toMatchObject({ line: 3, errors: [{ code: 'INVALID_DIMENSION', field: 'height' }] })
  await expect(confirmPackageImport(preview)).rejects.toMatchObject({ code: 'PACKAGE_IMPORT_INVALID', params: { errors: 1 } })
  expect(await fetchPackages()).toHaveLength(before)
  expect(await getMockDb().listEvents()).toHaveLength(events)
})

test('confirming a valid file creates every package in one write: IMPORTED, source IMPORT, a QR code each, one audit event', async () => {
  const events = (await getMockDb().listEvents()).length
  // HK-DNG-2609-01 đã có trong kho kiện (PK-0049): chỉ là cảnh báo, vẫn nhập
  const preview = await previewPackageImport(csvFile(['DN-0001,60,40,40,18,STANDARD,"KCN Hoà Khánh, Đà Nẵng",', 'hk-dng-2609-01,50,40,30,"9,5",Dễ vỡ,Huế,PT-006']))
  expect([preview.total, preview.valid, preview.errorRows, preview.warningRows]).toStrictEqual([2, 2, 0, 1])
  expect(preview.rows[1]?.warnings).toStrictEqual([{ code: 'PACKAGE_CODE_EXISTS', packageId: 'PK-0049' }])
  const created = await confirmPackageImport(preview)
  expect(created.map((pkg) => [pkg.id, pkg.packageCode, pkg.status, pkg.source, pkg.handlingClass, pkg.packageTypeId])).toStrictEqual([
    ['PK-0090', 'DN-0001', 'IMPORTED', 'IMPORT', 'STANDARD', undefined], ['PK-0091', 'hk-dng-2609-01', 'IMPORTED', 'IMPORT', 'FRAGILE', 'PT-006'],
  ])
  expect(new Set(created.map((pkg) => pkg.qrToken)).size).toBe(2)
  const log = await getMockDb().listEvents()
  expect(log).toHaveLength(events + 1)
  expect(log[0]).toMatchObject({ action: 'package.importConfirmed', actorId: 'US-0001', target: { type: 'package', id: 'PK-0090' }, params: { count: 2, lastPackageId: 'PK-0091' } })
})

test('file errors are refused with the backend codes before any row is read', async () => {
  await expect(previewPackageImport(new File(['x'], 'kien.pdf'))).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' })
  await expect(previewPackageImport(new File(['không phải file excel'], 'kien.xlsx'))).rejects.toMatchObject({ code: 'UNSUPPORTED_FILE_TYPE' })
  await expect(previewPackageImport(new File([''], 'kien.csv'))).rejects.toMatchObject({ code: 'EMPTY_FILE' })
  await expect(previewPackageImport(csvFile([]))).rejects.toMatchObject({ code: 'EMPTY_FILE' })
  await expect(previewPackageImport(new File(['package_code,length\r\nDN-1,60'], 'kien.csv'))).rejects.toMatchObject({
    code: 'IMPORT_COLUMNS_MISSING', params: { columns: ['width', 'height', 'weight', 'handling_class', 'destination'] },
  })
  const big = { name: 'kien.csv', size: 10 * 1024 * 1024 + 1 } as File
  await expect(previewPackageImport(big)).rejects.toMatchObject({ code: 'FILE_TOO_LARGE', params: { maxMb: 10 } })
  const rows = Array.from({ length: 1001 }, (_, index) => `DN-${index},60,40,40,18,STANDARD,Huế,`)
  await expect(previewPackageImport(csvFile(rows))).rejects.toMatchObject({ code: 'BATCH_TOO_LARGE', params: { max: 1000, rows: 1001 } })
})

test('the CSV template downloads as a file that previews with no error', async () => {
  const blob = await downloadPackageImportTemplate('csv', importTemplateRows(createTranslator('vi')), 'Kho kiện')
  const text = await blob.text()
  expect(parseCsv(text)[0]).toStrictEqual(['Mã kiện', 'Dài (cm)', 'Rộng (cm)', 'Cao (cm)', 'Khối lượng (kg)', 'Loại hàng', 'Điểm đến', 'Loại kiện'])
  const preview = await previewPackageImport(new File([text], 'mau.csv'))
  expect([preview.total, preview.valid, preview.errorRows, preview.warningRows]).toStrictEqual([2, 2, 0, 0])
})

test('labels carry the type only for packages that have one, and the company of the package', async () => {
  // PK-0001 thùng nước suối gắn loại PT-001; PK-0054 kiện nhập file đi Huế không gắn loại
  const labels = await fetchPackageLabels({ ids: ['PK-0054', 'PK-0001', 'PK-9999'] })
  expect(labels.map((label) => [label.package.id, label.type?.name, label.owner?.id])).toStrictEqual([
    ['PK-0054', undefined, 'LOG-001'], ['PK-0001', 'Thùng nước suối 24 chai', 'LOG-001'],
  ])
  // Không chọn kiện nào thì không có nhãn nào: kho kiện có hàng nghìn kiện, không in "tất cả"
  expect(await fetchPackageLabels({})).toStrictEqual([])
})

test('the labels of a trip are the pool packages of its instances, in the order of the trip (FE-3b-07)', async () => {
  // Chuyến nháp TRIP-014: 3 dòng kiện nhập tay, mỗi instance một kiện kho kiện nguồn TRIP
  const trip = await getMockDb().getTrip('TRIP-014')
  const labels = await fetchPackageLabels({ tripId: 'TRIP-014' })
  expect(labels).toHaveLength(trip.packages.reduce((sum, line) => sum + line.quantity, 0))
  expect(labels.slice(0, 2).map((label) => label.package.packageCode)).toStrictEqual(['PKG-001-01', 'PKG-001-02'])
  expect(new Set(labels.map((label) => [label.package.source, label.package.tripId].join())) ).toStrictEqual(new Set(['TRIP,TRIP-014']))
})

test('looking a package up by its QR code or by what was typed returns it with its trip and stop; an unknown code is refused', async () => {
  const [label] = await fetchPackageLabels({ tripId: 'TRIP-2026-0914' })
  const token = label?.package.qrToken ?? ''
  const scanned = await scanPackage(token.toLowerCase())
  expect(scanned).toMatchObject({ package: { id: label?.package.id, status: 'ASSIGNED' }, trip: { id: 'TRIP-2026-0914' }, stop: { number: 1 } })
  expect(scanned.stop?.name).toBe((await getMockDb().getTrip('TRIP-2026-0914')).stops[0]?.name)
  // Kiện còn ở kho kiện: không chuyến, không điểm giao; loại kiện kèm theo khi có
  expect(await lookupPackages('mp-sh48-0913-01')).toMatchObject([{ package: { id: 'PK-0023' }, type: { id: 'PT-004' }, trip: undefined, stop: undefined }])
  await expect(scanPackage('LM-0000-0000-0000')).rejects.toMatchObject({ code: 'QR_UNKNOWN' })
  await expect(lookupPackages('KHONG-CO-MA-NAY')).rejects.toMatchObject({ code: 'QR_UNKNOWN', params: { token: 'KHONG-CO-MA-NAY' } })
})

test('the warehouse reports a flagged package found: the flag is cleared and the dispatcher gets an event', async () => {
  // Kiện nhập file PK-0040 vừa bị gắn cờ "Không tìm thấy" (như kiện bị bỏ khỏi chuyến vì kho không tìm thấy lúc soạn, D-92)
  await getMockDb().flagPackage('PK-0040', 'NOT_FOUND')
  const flagged = (await fetchPackages()).find((pkg) => pkg.id === 'PK-0040')
  expect(flagged?.flags).toStrictEqual(['NOT_FOUND'])
  getMockDb().restoreSession('US-0003')
  expect((await reportPackageFound(flagged?.qrToken ?? '')).flags).toStrictEqual([])
  getMockDb().restoreSession('US-0001')
  expect((await getMockDb().listEvents())[0]).toMatchObject({ action: 'package.found', actorId: 'US-0003', target: { type: 'package', id: flagged?.id } })
})
