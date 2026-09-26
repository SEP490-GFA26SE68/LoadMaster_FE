import { expect, test } from 'vitest'
import {
  highlightParts, RESULTS_PER_GROUP, SEARCH_GROUPS, searchSources, type SearchResultGroup, type SearchSources,
} from './quick-search'

/** Tìm nhanh (LM-099): nguồn dựng tay, tên tiếng Việt có dấu để kiểm tìm không dấu. */
const SOURCES: SearchSources = {
  trips: [
    { id: 'TRIP-001', name: 'Tuyến Thủ Đức – Dĩ An', stops: ['Kho Dĩ An', 'Siêu thị Thủ Đức'], packageIds: ['PKG-001', 'PKG-002'] },
    { id: 'TRIP-002', name: 'Tuyến Q.7 – An Phú', stops: ['Cửa hàng Phú Mỹ Hưng', 'Biên Hoà Mart'], packageIds: ['PKG-001', 'PKG-010'] },
  ],
  vehicles: [
    { id: 'VEHICLE-001', name: 'Isuzu NQR 550 · 51C-284.19' },
    { id: 'VEHICLE-002', name: 'Hyundai HD210 · 60C-446.32' },
  ],
  users: [
    { id: 'US-0011', fullName: 'Đỗ Thị Hạnh', email: 'hanh.do@loadmaster.vn', role: 'warehouse' },
    { id: 'US-0003', fullName: 'Lê Văn Hải', email: 'kho@loadmaster.vn', role: 'warehouse' },
  ],
}

/** Nhóm → các `href`, đủ để đọc cả loại, thứ tự và đích mở. */
const hrefs = (groups: readonly SearchResultGroup[]) => groups.map(({ group, results }) => [group, results.map((result) => result.href)])

test('an empty or blank query finds nothing', () => {
  expect(searchSources(SOURCES, '', SEARCH_GROUPS)).toStrictEqual([])
  expect(searchSources(SOURCES, '   ', SEARCH_GROUPS)).toStrictEqual([])
})

test('trips match code, name and stop names without accents; packages match the original package code', () => {
  expect(hrefs(searchSources(SOURCES, 'thu duc', SEARCH_GROUPS))).toStrictEqual([['trips', ['/chuyen/TRIP-001']]])
  // "Biên Hoà Mart" chỉ là tên điểm giao của TRIP-002
  expect(hrefs(searchSources(SOURCES, 'bien hoa', SEARCH_GROUPS))).toStrictEqual([['trips', ['/chuyen/TRIP-002']]])
  expect(hrefs(searchSources(SOURCES, 'trip-002', SEARCH_GROUPS))).toStrictEqual([['trips', ['/chuyen/TRIP-002']]])
  expect(hrefs(searchSources(SOURCES, 'pkg-001', SEARCH_GROUPS))).toStrictEqual([
    ['packages', ['/chuyen/TRIP-001?kien=PKG-001', '/chuyen/TRIP-002?kien=PKG-001']],
  ])
})

test('vehicles match the plate inside the name; users match name or email', () => {
  expect(hrefs(searchSources(SOURCES, '51c', SEARCH_GROUPS))).toStrictEqual([['vehicles', ['/doi-xe/VEHICLE-001']]])
  expect(hrefs(searchSources(SOURCES, 'hanh', SEARCH_GROUPS))).toStrictEqual([['users', ['/nguoi-dung?q=US-0011']]])
  expect(hrefs(searchSources(SOURCES, 'kho@', SEARCH_GROUPS))).toStrictEqual([['users', ['/nguoi-dung?q=US-0003']]])
  const [users] = searchSources(SOURCES, 'le van hai', SEARCH_GROUPS)
  expect(users?.results[0]).toMatchObject({ group: 'users', id: 'US-0003', name: 'Lê Văn Hải', email: 'kho@loadmaster.vn', role: 'warehouse' })
})

test('only the permitted groups, in their order; groups without a result are left out', () => {
  // "an" có trong tên chuyến ("Dĩ An", "An Phú") và tên người dùng ("Hạnh", "Văn")
  expect(hrefs(searchSources(SOURCES, 'an', ['trips', 'packages', 'vehicles']))).toStrictEqual([
    ['trips', ['/chuyen/TRIP-001', '/chuyen/TRIP-002']],
  ])
  expect(hrefs(searchSources(SOURCES, 'an', ['users', 'trips']))).toStrictEqual([
    ['users', ['/nguoi-dung?q=US-0011', '/nguoi-dung?q=US-0003']],
    ['trips', ['/chuyen/TRIP-001', '/chuyen/TRIP-002']],
  ])
  expect(searchSources(SOURCES, 'hanh', ['trips', 'packages', 'vehicles'])).toStrictEqual([])
})

test(`at most ${RESULTS_PER_GROUP} results per group, in the store order`, () => {
  const many: SearchSources = {
    ...SOURCES,
    trips: Array.from({ length: 12 }, (_, index) => ({ id: `TRIP-1${String(index).padStart(2, '0')}`, name: 'Tuyến Long Bình', stops: [], packageIds: [] })),
  }
  const [trips] = searchSources(many, 'long binh', SEARCH_GROUPS)
  expect(RESULTS_PER_GROUP).toBe(8)
  expect(trips?.results.map((result) => result.id)).toStrictEqual([
    'TRIP-100', 'TRIP-101', 'TRIP-102', 'TRIP-103', 'TRIP-104', 'TRIP-105', 'TRIP-106', 'TRIP-107',
  ])
})

/** Đoạn tô viết gọn: phần khớp nằm trong [ ]. */
const marked = (text: string, query: string) =>
  highlightParts(text, query).map((part) => (part.match ? `[${part.text}]` : part.text)).join('')

test('highlight marks every occurrence of every term, accent- and case-insensitively, on the original characters', () => {
  expect(marked('TRIP-006', '006')).toBe('TRIP-[006]')
  expect(marked('US-0006', '006')).toBe('US-0[006]')
  expect(marked('Tuyến Biên Hoà – Thủ Đức', 'bien hoa')).toBe('Tuyến [Biên] [Hoà] – Thủ Đức')
  expect(marked('Tuyến Thủ Đức – Thủ Dầu Một', 'thu')).toBe('Tuyến [Thủ] Đức – [Thủ] Dầu Một')
  expect(marked('Đỗ Thị Hạnh', 'do')).toBe('[Đỗ] Thị Hạnh')
  // Chữ có dấu rời (NFD): dấu đi cùng chữ gốc của nó
  expect(marked('Hòa', 'hoa')).toBe('[Hòa]')
  // Không khớp qua khoảng trắng giữa hai từ
  expect(marked('Thu Duc', 'huduc')).toBe('Thu Duc')
})

test('highlight of an empty query or a text without a match is one plain part', () => {
  expect(highlightParts('PKG-001', '')).toStrictEqual([{ text: 'PKG-001', match: false }])
  expect(highlightParts('PKG-001', 'xe')).toStrictEqual([{ text: 'PKG-001', match: false }])
  expect(highlightParts('', 'xe')).toStrictEqual([{ text: '', match: false }])
})
