import { expect, test } from 'vitest'
import { MAX_ASSISTANT_LINKS, openableLinks } from './assistant-links'

/** Liên kết máy chủ gắn dưới câu trả lời: chỉ đường dẫn trong app mà người xem mở được, không trùng, tối đa ba. */
const opens = (to: string) => to !== '/giam-sat'

test('keeps in-app links the viewer can open, in order, without duplicates, at most three', () => {
  const links = [
    { label: 'Chuyến hàng', to: '/chuyen' },
    { label: 'Giám sát', to: '/giam-sat' },
    { label: 'Chuyến hàng (lặp)', to: '/chuyen' },
    { label: 'Chi tiết', to: '/chuyen/TRIP-2026-1101' },
    { label: 'Bảng giá', to: '/bang-gia' },
    { label: 'Hồ sơ', to: '/ho-so' },
  ]
  expect(openableLinks(links, opens)).toStrictEqual([
    { label: 'Chuyến hàng', to: '/chuyen' },
    { label: 'Chi tiết', to: '/chuyen/TRIP-2026-1101' },
    { label: 'Bảng giá', to: '/bang-gia' },
  ])
  expect(MAX_ASSISTANT_LINKS).toBe(3)
})

test('never keeps a link that leaves the app or has no label, whatever the route check says', () => {
  const links = ['https://lua.example/x', '//lua.example/x', 'javascript:alert(1)', '/\\lua.example', 'chuyen', '/chuyen x'].map((to) => ({ label: 'Mở', to }))
  expect(openableLinks([...links, { label: '  ', to: '/chuyen' }], () => true)).toStrictEqual([])
})
