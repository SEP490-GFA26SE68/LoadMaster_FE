import { expect, test } from 'vitest'
import { packageOfCode, type CurrentStopDto, type StopPackageDto } from './driver-dto'

/**
 * Mã tài xế gõ khi dỡ ở điểm của backend (`packageOfCode`): khớp mã riêng của một kiện trước (mã QR, mã vạch, mã của kho kiện), rồi mới
 * tới mã của bên gửi — chỉ nhận khi đúng một kiện của điểm mang nó, như `resolveVerifyCode` của kho mẫu.
 */
const pkg = (packageId: number, extra: Partial<StopPackageDto> = {}): StopPackageDto => ({
  packageId, packageName: null, trackingBarcode: null, weight: null, unloadOrder: null, ...extra,
})

const stop = (...packages: StopPackageDto[]): CurrentStopDto => ({ stopId: 2, stopSequence: 2, stopName: null, address: null, packages })

test('mã vạch và mã của kho kiện: không phân biệt hoa thường, bỏ khoảng trắng hai đầu; kiện có mã vạch vẫn gõ được mã của kho kiện', () => {
  const dto = stop(pkg(11, { trackingBarcode: 'LB-PK-0007' }), pkg(12))
  expect(packageOfCode(dto, '  lb-pk-0007 ')).toStrictEqual({ kind: 'matched', packageId: 11, label: 'LB-PK-0007' })
  expect(packageOfCode(dto, '11')).toStrictEqual({ kind: 'matched', packageId: 11, label: 'LB-PK-0007' })
  expect(packageOfCode(dto, '12')).toStrictEqual({ kind: 'matched', packageId: 12, label: '12' })
  expect(packageOfCode(dto, 'LB-PK-0008')).toStrictEqual({ kind: 'unknown' })
  expect(packageOfCode(dto, '   ')).toStrictEqual({ kind: 'unknown' })
})

test('mã của bên gửi và mã QR khi backend trả: không phân biệt hoa thường; dòng không kèm kiện bị bỏ', () => {
  const dto = stop(
    pkg(11, { trackingBarcode: 'LB-PK-0007', packageCode: 'BHXDA-1001', qrToken: '0b9f3c1e-5a7d-4c2e-9f1a-3d6b8e2c4a10' }),
    { ...pkg(0), packageId: null, packageCode: 'BHXDA-1001' },
  )
  const matched = { kind: 'matched', packageId: 11, label: 'BHXDA-1001' }
  expect(packageOfCode(dto, 'bhxda-1001')).toStrictEqual(matched)
  expect(packageOfCode(dto, '0B9F3C1E-5A7D-4C2E-9F1A-3D6B8E2C4A10')).toStrictEqual(matched)
  expect(packageOfCode(dto, 'lb-pk-0007')).toStrictEqual(matched)
})

test('mã của bên gửi trùng nhiều kiện của điểm: từ chối vì không biết là kiện nào; mã riêng của kiện vẫn khớp', () => {
  const dto = stop(pkg(11, { trackingBarcode: 'LB-PK-0007', packageCode: 'BHXDA-2002' }), pkg(12, { packageCode: 'bhxda-2002' }), pkg(13, { packageCode: 'BHXDA-3003' }))
  expect(packageOfCode(dto, 'BHXDA-2002')).toStrictEqual({ kind: 'ambiguous', count: 2 })
  // Dòng của kiện trùng mã của bên gửi đứng đầu bằng mã riêng của kiện: gõ mã đó được
  expect(packageOfCode(dto, 'LB-PK-0007')).toStrictEqual({ kind: 'matched', packageId: 11, label: 'LB-PK-0007' })
  expect(packageOfCode(dto, '12')).toStrictEqual({ kind: 'matched', packageId: 12, label: '12' })
  expect(packageOfCode(dto, 'bhxda-3003')).toStrictEqual({ kind: 'matched', packageId: 13, label: 'BHXDA-3003' })
})

test('mã riêng của một kiện thắng mã của bên gửi của kiện khác; mã riêng trùng giữa hai kiện cũng là trùng', () => {
  const dto = stop(pkg(11, { trackingBarcode: 'BHXDA-1001' }), pkg(12, { packageCode: 'BHXDA-1001' }), pkg(13, { trackingBarcode: '11' }))
  expect(packageOfCode(dto, 'BHXDA-1001')).toStrictEqual({ kind: 'matched', packageId: 11, label: 'BHXDA-1001' })
  expect(packageOfCode(dto, '11')).toStrictEqual({ kind: 'ambiguous', count: 2 })
})
