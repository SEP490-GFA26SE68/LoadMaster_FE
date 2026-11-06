import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test, vi } from 'vitest'
import { artworkBoxesInLoadingOrder } from '@/components/cargo-artwork-boxes'
import { I18nProvider } from '@/lib/i18n'
import { OptimizationRunDialog, type RunDialogContext } from './OptimizationRunDialog'
import { DEFAULT_SETUP } from './optimization-request'
import type { RunProgress } from './run-progress'

/**
 * Hộp thoại đang chạy tối ưu: hình thùng xếp dần theo phần việc thật (`checked / workload`), chạy vòng khi chưa có số, đứng yên khi người
 * dùng chọn giảm chuyển động, và các bước thật của lần chạy.
 */

const BOXES = artworkBoxesInLoadingOrder().length
const CONTEXT: RunDialogContext = { tripId: 'TRIP-2026-0914', vehicleName: 'Truck 6m', total: 10, values: DEFAULT_SETUP, credit: null }

afterEach(() => vi.unstubAllGlobals())

function reduceMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)', media: query, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }))
}

function renderDialog(progress: RunProgress | null) {
  const view = render(<I18nProvider><OptimizationRunDialog progress={progress} context={CONTEXT} onCancel={() => {}} /></I18nProvider>)
  const dialog = screen.getByRole('dialog', { name: 'Đang tối ưu phương án xếp hàng' })
  const figure = () => {
    const svg = dialog.querySelector('[data-run-figure]')
    if (!svg) throw new Error('Không thấy hình của hộp thoại')
    return svg
  }
  const boxes = () => [...figure().querySelectorAll('[data-run-box]')]
  const rerender = (next: RunProgress | null) =>
    view.rerender(<I18nProvider><OptimizationRunDialog progress={next} context={CONTEXT} onCancel={() => {}} /></I18nProvider>)
  return { dialog, figure, boxes, rerender }
}

const halfway: RunProgress = { total: 10, stage: 'pack', plans: { MAX_VOLUME: { placed: 10, total: 10 }, AXLE_BALANCE: { placed: 5, total: 10 } } }
const finished: RunProgress = {
  total: 10, stage: 'save',
  plans: { MAX_VOLUME: { placed: 10, total: 10 }, AXLE_BALANCE: { placed: 10, total: 10 }, MIN_REHANDLING: { placed: 10, total: 10 } },
}

test('the figure fills with the real share of work done, and carries no number of its own', () => {
  const { dialog, figure, boxes, rerender } = renderDialog(halfway)
  expect(within(dialog).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '15')
  expect(within(dialog).getByRole('progressbar')).toHaveAttribute('aria-valuemax', '30')
  // 15 / 30 kiện đã xét: đúng nửa số khối, làm tròn xuống
  expect(figure()).toHaveAttribute('data-run-figure', 'determinate')
  expect(boxes()).toHaveLength(Math.floor(BOXES / 2))
  expect(figure()).toHaveAttribute('aria-hidden', 'true')
  expect(figure().querySelector('text')).toBeNull()
  expect(figure().textContent).toBe('')
  // Khối mới hạ xuống chỗ của nó; không có dải chạy vòng
  expect(boxes().every((box) => box.getAttribute('class')?.includes('lm-box-in'))).toBe(true)

  rerender(finished)
  expect(boxes()).toHaveLength(BOXES)
})

test('before the first progress event the figure is indeterminate: a wave of boxes, no fill level', () => {
  for (const progress of [null, { total: 10, stage: 'reserve', plans: {} } satisfies RunProgress]) {
    const { figure, boxes } = renderDialog(progress)
    expect(figure()).toHaveAttribute('data-run-figure', 'indeterminate')
    expect(boxes()).toHaveLength(BOXES)
    expect(boxes().every((box) => box.getAttribute('class')?.includes('lm-run-wave'))).toBe(true)
    // Mỗi khối bắt đầu lệch một nhịp: dải chạy từ vách trước ra cửa sau
    expect(new Set(boxes().map((box) => (box as SVGElement).style.animationDelay)).size).toBe(BOXES)
    expect(figure().textContent).toBe('')
    cleanup()
  }
})

test('with reduced motion nothing animates: the figure stands at the current level, and the indeterminate figure is an empty truck', () => {
  reduceMotion()
  const { figure, boxes, rerender } = renderDialog(halfway)
  expect(boxes()).toHaveLength(Math.floor(BOXES / 2))
  expect(figure().querySelector('[class*="animate-"]')).toBeNull()

  rerender({ total: 10, stage: 'reserve', plans: {} })
  expect(figure()).toHaveAttribute('data-run-figure', 'indeterminate')
  expect(boxes()).toHaveLength(0)
  expect(figure().querySelector('[class*="animate-"]')).toBeNull()
})

test('the steps of the run follow the stage the run reports', () => {
  const { dialog, rerender } = renderDialog({ ...halfway, stage: 'pack' })
  const steps = () => within(dialog).getByRole('list', { name: 'Các bước của lần chạy' }).querySelectorAll('li')
  expect([...steps()].map((step) => step.textContent)).toStrictEqual(['Giữ credit: đã xong', 'Xếp ba phương án: đang làm', 'Lưu kết quả: chưa tới'])
  expect(steps()[1]).toHaveAttribute('aria-current', 'step')

  rerender(finished)
  expect([...steps()].map((step) => step.getAttribute('data-state'))).toStrictEqual(['done', 'done', 'current'])
  expect(steps()[2]).toHaveAttribute('aria-current', 'step')
})
