import { expect, test } from 'vitest'
import { answerBlocks } from './assistant-text'

/** Chữ của mô hình thành đoạn và danh sách để vẽ bằng phần tử thường (không HTML của mô hình); dấu định dạng Markdown bị bỏ. */
test('paragraphs split on blank lines, list lines become list items, markdown marks are dropped', () => {
  const text = [
    '## Chuyến TRIP-2026-1101',
    'Chuyến **đã lập kế hoạch**,',
    'chờ duyệt phương án.',
    '',
    'Hai điểm giao:',
    '- Kho Tân Vạn',
    '* `Thủ Đức`',
    '',
    '1. Mở Planner',
    '2) Bấm Duyệt',
  ].join('\r\n')

  expect(answerBlocks(text)).toStrictEqual([
    { kind: 'paragraph', text: 'Chuyến TRIP-2026-1101' },
    { kind: 'paragraph', text: 'Chuyến đã lập kế hoạch,\nchờ duyệt phương án.' },
    { kind: 'paragraph', text: 'Hai điểm giao:' },
    { kind: 'bullets', items: ['Kho Tân Vạn', 'Thủ Đức'] },
    { kind: 'steps', items: ['Mở Planner', 'Bấm Duyệt'] },
  ])
})

test('an empty answer has no blocks; a number inside a sentence is not a list', () => {
  expect(answerBlocks('  \n\n ')).toStrictEqual([])
  expect(answerBlocks('Gói Pro giá 3.500.000 đ.\n2 điểm giao.')).toStrictEqual([{ kind: 'paragraph', text: 'Gói Pro giá 3.500.000 đ.\n2 điểm giao.' }])
})
