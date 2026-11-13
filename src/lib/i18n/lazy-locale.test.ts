import { expect, test } from 'vitest'
import main from '@/main.tsx?raw'
import translate from './translate.ts?raw'
import { isLocaleLoaded, loadLocale } from './translate'

test('từ điển en không nằm trong bundle đầu: translate.ts chỉ import động, main.tsx tải ngôn ngữ đầu trước khi vẽ', () => {
  expect(translate).not.toMatch(/^import [^\n]* from '\.\/en'/m)
  expect(translate).toContain(`import('./en')`)
  expect(main).toMatch(/await loadLocale\(readInitialLocale\(\)\)[^\n]*\n\s*\ncreateRoot/)
})

test('loadLocale: vi có sẵn, en tải một lần', async () => {
  expect(isLocaleLoaded('vi')).toBe(true)
  await loadLocale('en')
  await loadLocale('en')
  expect(isLocaleLoaded('en')).toBe(true)
})
