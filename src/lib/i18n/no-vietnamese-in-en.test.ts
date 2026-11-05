import { expect, test } from 'vitest'
import { findHardcodedVietnamese } from './hardcoded-strings'

/**
 * Cổng kiểm soát từ điển tiếng Anh (EN): mọi file trong `src/lib/i18n/en/` và `en.ts`
 * không được chứa chuỗi hoặc từ ngữ tiếng Việt có dấu.
 */
const EN_SOURCES = import.meta.glob<string>('/src/lib/i18n/en{,.ts,/**/*.ts}', {
  query: '?raw',
  import: 'default',
  eager: true,
})

test('no hard-coded Vietnamese in English dictionary', () => {
  const offenders = Object.entries(EN_SOURCES).flatMap(([path, source]) =>
    findHardcodedVietnamese(source).map(({ line, text }) => `${path}:${line}  ${text}`),
  )

  expect(offenders).toStrictEqual([])
})
