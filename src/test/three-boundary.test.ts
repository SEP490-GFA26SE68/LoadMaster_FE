import { describe, expect, test } from 'vitest'

/**
 * Ranh giới 3D (AGENTS mục 7): ngoài `src/features/viewer3d` không file nào import `three`, `@react-three/*`, `@react-spring/three`
 * hay `camera-controls` — màn khác (kể cả trang giới thiệu) chỉ tải lười component của viewer3d và các module thuần của nó. Các module
 * thuần mà trang giới thiệu import thẳng cũng không được kéo Three.js vào chunk của trang.
 */

const sources = import.meta.glob<string>('/src/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true })

const THREE_IMPORT = /(?:\bfrom|\bimport)\s*\(?\s*['"](three|three\/[^'"]+|@react-three\/[^'"]+|@react-spring\/three|camera-controls)['"]/g

const PURE_MODULES = [
  '/src/features/viewer3d/landing/story-clock.ts',
  '/src/features/viewer3d/landing/story-timeline.ts',
  '/src/features/viewer3d/landing/diorama-layout.ts',
  '/src/features/viewer3d/landing-fill.ts',
  '/src/features/viewer3d/scene/frame-fit.ts',
  '/src/features/viewer3d/scene/truck-layout.ts',
  '/src/features/viewer3d/scene/units.ts',
]

const threeImports = (path: string) => [...(sources[path] ?? '').matchAll(THREE_IMPORT)].map((match) => match[1])

/** `import … from` còn lại sau khi biên dịch (bỏ `import type`), đổi ra đường dẫn trong `src` không đuôi. */
const VALUE_IMPORT = /^import\s+(?!type\b)[^'"]*from\s+['"]([^'"]+)['"]/gm
const valueImports = (path: string) => [...(sources[path] ?? '').matchAll(VALUE_IMPORT)]
  .map(({ 1: spec = '' }) => (spec.startsWith('@/') ? `/src/${spec.slice(2)}` : spec.startsWith('.') ? new URL(spec, `file://${path}`).pathname : spec))

describe('three.js boundary', () => {
  test('the glob sees the source tree', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(100)
    expect(threeImports('/src/features/viewer3d/scene/SceneCanvas.tsx')).toContain('@react-three/fiber')
  })

  test('no file outside src/features/viewer3d imports three, @react-three/*, @react-spring/three or camera-controls', () => {
    const offenders = Object.keys(sources)
      .filter((path) => !path.startsWith('/src/features/viewer3d/'))
      .flatMap((path) => threeImports(path).map((name) => `${path} → ${name}`))
    expect(offenders).toEqual([])
  })

  test('the pure modules the landing page imports stay free of three.js', () => {
    for (const path of PURE_MODULES) {
      expect(sources[path], path).toBeTypeOf('string')
      expect(threeImports(path), path).toEqual([])
    }
  })

  test('the landing page reaches viewer3d statically only through the pure modules, and they only through each other', () => {
    const marketing = Object.keys(sources).filter((path) => path.startsWith('/src/features/marketing/') && !path.includes('.test.'))
    const reached = [...marketing, ...PURE_MODULES].flatMap(valueImports).filter((path) => path.startsWith('/src/features/viewer3d/'))
    expect(reached.length).toBeGreaterThan(0)
    expect([...new Set(reached)].filter((path) => !PURE_MODULES.includes(`${path}.ts`))).toEqual([])
  })
})
