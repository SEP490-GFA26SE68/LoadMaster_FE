import { expect, test } from 'vitest'

import { dataWarningsOf, packageCodeIndex } from './data-warnings'

test('giữ hai mã có câu, bỏ mã lạ và cảnh báo không có kiện, gộp mục trùng mã', () => {
  expect(dataWarningsOf([
    { code: 'PACKAGE_TYPE_MISSING', packageIds: ['4'] },
    { code: 'FUTURE_WARNING', packageIds: ['1'] },
    { code: 'TOP_LOAD_CAPACITY_MISSING', packageIds: ['3', 4] },
    { code: 'TOP_LOAD_CAPACITY_MISSING', packageIds: ['4', '5', ' '] },
    { code: 'PACKAGE_TYPE_MISSING', packageIds: [] },
    { code: null, packageIds: ['9'] },
    {},
  ])).toEqual([
    { code: 'TOP_LOAD_CAPACITY_MISSING', packageIds: ['3', '4', '5'] },
    { code: 'PACKAGE_TYPE_MISSING', packageIds: ['4'] },
  ])
})

test('máy chủ cũ không trả cảnh báo là danh sách rỗng', () => {
  expect(dataWarningsOf(undefined)).toEqual([])
  expect(dataWarningsOf(null)).toEqual([])
})

test('bảng mã kiện lấy từ chỗ xếp và kiện chưa xếp, bỏ mã chỉ là mã số', () => {
  const index = packageCodeIndex([
    { placements: [{ packageId: '70', code: 'KT-A-001' }, { packageId: '72', code: '72' }], unplaced: [{ packageId: '71', code: 'KT-A-002' }] },
    { placements: [{ packageId: '70', code: 'KT-A-001' }], unplaced: [] },
  ])
  expect([...index]).toEqual([['70', 'KT-A-001'], ['71', 'KT-A-002']])
})
