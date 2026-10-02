import { beforeAll, expect, test } from 'vitest'
import { getMockDb } from '@/lib/mock-db'
import { fetchPackageLabels, fetchPackages, registerPackages } from './packages-source-api'

/**
 * Hộp thoại "Đăng ký kiện" theo loại kiện trên kho kiện mới (FE-3b-01): mỗi dòng đăng ký thành các kiện mang kích thước, khối lượng
 * của loại kiện và điểm đến của hộp thoại. Kho dùng chung của file, phiên điều phối viên Long Bình; seed có PK-0001…0088.
 */
beforeAll(() => {
  getMockDb().restoreSession('US-0001')
})

test('registering by quantity creates pool packages sized by the type, with numbered sender codes and one destination', async () => {
  // Thùng dầu ăn PT-003: 45 × 32 × 30 cm, 12 kg
  const created = await registerPackages({ kind: 'quantity', input: { packageTypeId: 'PT-003', destination: 'KCN Amata, TP. Biên Hoà, Đồng Nai', reference: 'MP-DA12-0915' }, quantity: 3 })
  expect(created.map((pkg) => [pkg.id, pkg.packageCode])).toStrictEqual([
    ['PK-0089', 'MP-DA12-0915-01'], ['PK-0090', 'MP-DA12-0915-02'], ['PK-0091', 'MP-DA12-0915-03'],
  ])
  expect(created[0]).toMatchObject({
    lengthCm: 45, widthCm: 32, heightCm: 30, weightKg: 12, handlingClass: 'STANDARD', destination: 'KCN Amata, TP. Biên Hoà, Đồng Nai', packageTypeId: 'PT-003',
    status: 'IMPORTED', flags: [], source: 'MANUAL', companyId: 'LOG-001',
  })

  // Một kiện giữ nguyên mã lô; không có mã lô thì mã kiện là mã của kho
  const [single] = await registerPackages({ kind: 'single', input: { packageTypeId: 'PT-001', destination: 'Huế', reference: 'MP-NS24-0915' } })
  const [plain] = await registerPackages({ kind: 'single', input: { packageTypeId: 'PT-001', destination: 'Huế' } })
  expect([single?.packageCode, plain?.id, plain?.packageCode]).toStrictEqual(['MP-NS24-0915', 'PK-0093', 'PK-0093'])
})

test('file rows are one import: a bad row writes nothing', async () => {
  const before = (await fetchPackages()).length
  const rows = [{ packageTypeId: 'PT-002', quantity: 2, destination: 'Đà Nẵng' }, { packageTypeId: 'PT-004', quantity: 1, destination: 'Đà Nẵng', reference: 'SH-01' }]
  await expect(registerPackages({ kind: 'rows', rows: [...rows, { packageTypeId: 'PT-404', quantity: 1, destination: 'Đà Nẵng' }] })).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(registerPackages({ kind: 'rows', rows: [...rows, { packageTypeId: 'PT-001', quantity: 501, destination: 'Đà Nẵng' }] })).rejects.toMatchObject({ code: 'QUANTITY_INVALID', params: { min: 1, max: 500 } })
  await expect(registerPackages({ kind: 'rows', rows: [{ packageTypeId: 'PT-001', quantity: 1, destination: '  ' }] })).rejects.toMatchObject({ code: 'PACKAGE_INVALID', params: { field: 'destination' } })
  expect(await fetchPackages()).toHaveLength(before)
  const created = await registerPackages({ kind: 'rows', rows })
  expect(created.map((pkg) => [pkg.packageTypeId, pkg.source, pkg.packageCode === pkg.id])).toStrictEqual([['PT-002', 'IMPORT', true], ['PT-002', 'IMPORT', true], ['PT-004', 'IMPORT', false]])
})

test('labels carry the type only for packages that have one, and the company of the package', async () => {
  // PK-0001 thùng nước suối gắn loại PT-001; PK-0054 kiện nhập file đi Huế không gắn loại
  const labels = await fetchPackageLabels(['PK-0054', 'PK-0001', 'PK-9999'])
  expect(labels.map((label) => [label.package.id, label.type?.name, label.owner?.id])).toStrictEqual([
    ['PK-0054', undefined, 'LOG-001'], ['PK-0001', 'Thùng nước suối 24 chai', 'LOG-001'],
  ])
})
