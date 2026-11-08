import { expect, test } from 'vitest'
import { findHardcodedVietnamese } from './hardcoded-strings'

/**
 * Cổng i18n (LM-070, LM-071): chữ hiển thị đi qua từ điển `vi`/`en`. File được phép chứa tiếng Việt:
 * chính từ điển, dữ liệu mẫu (`*.mock.ts`, seed kho, fixture domain) và test. Ngoại lệ còn lại ghi ở `ALLOWED` kèm lý do.
 */
const SOURCES = import.meta.glob<string>('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })

const EXCLUDED = [
  /^\/src\/lib\/i18n\/(vi|en)(\.ts$|\/)/,
  /\.test(-d)?\.tsx?$/,
  /\.bench\.ts$/,
  /\.mock\.ts$/,
  /^\/src\/lib\/mock-db\/seed-/,
  /^\/src\/domain\/fixtures\//,
  /^\/src\/test\//,
]

/** Đường dẫn → lý do. Chỉ thêm khi chuỗi không phải chữ giao diện (tên riêng trong dữ liệu, mẫu nhập liệu cố định). */
const ALLOWED: Readonly<Record<string, string>> = {
  '/src/lib/i18n/hardcoded-strings.ts': 'bảng ký tự có dấu dùng để phát hiện',
  '/src/lib/i18n/locale.ts': 'tên ngôn ngữ viết bằng chính ngôn ngữ đó (Tiếng Việt / English), không dịch',
}

/** Thư mục đã dịch xong và được cổng giữ. LM-070 thêm luồng Spec, LM-071 mở rộng ra toàn `src/`. */
const ENFORCED = ['/src/']

/** Chưa dịch: rỗng từ LM-071 — toàn `src/` đi qua từ điển. Không thêm lại thư mục vào đây. */
const PENDING: readonly string[] = []

test('no hard-coded Vietnamese UI text outside the dictionaries', () => {
  const offenders = Object.entries(SOURCES)
    .filter(([path]) => ENFORCED.some((dir) => path.startsWith(dir)))
    .filter(([path]) => !PENDING.some((dir) => path.startsWith(dir)))
    .filter(([path]) => !EXCLUDED.some((pattern) => pattern.test(path)) && !(path in ALLOWED))
    .flatMap(([path, source]) => findHardcodedVietnamese(source).map(({ line, text }) => `${path}:${line}  ${text}`))
  expect(offenders).toStrictEqual([])
})
