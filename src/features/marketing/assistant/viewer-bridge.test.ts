import { afterEach, describe, expect, it, vi } from 'vitest'
import type { UiAction } from './assistant-api'
import { dispatchUiActions, registerViewer, unregisterViewer, viewerContext, type ViewerHandle } from './viewer-bridge'

function handle(over: Partial<ViewerHandle> = {}): ViewerHandle {
  return {
    tripCode: 'TRIP-0001',
    loadPlanId: 41,
    selectedPackageCode: null,
    mode: 'view',
    totalSteps: 12,
    placementIdOf: (code) => (code === 'PK-7' ? 'pl-7' : null),
    select: vi.fn(),
    setCameraPreset: vi.fn(),
    setStep: vi.fn(),
    setColorMode: vi.fn(),
    setLeftTab: vi.fn(),
    ...over,
  }
}

afterEach(() => unregisterViewer())

describe('viewer-bridge', () => {
  it('không có Planner thì không có ngữ cảnh và bỏ mọi lệnh', () => {
    expect(viewerContext()).toBeNull()
    expect(dispatchUiActions([{ type: 'setCameraPreset', preset: 'tren' }])).toBe(0)
  })

  it('ngữ cảnh chỉ gồm chuyến, phương án và kiện đang chọn', () => {
    registerViewer(handle({ selectedPackageCode: 'PK-7' }))
    expect(viewerContext()).toEqual({ tripCode: 'TRIP-0001', loadPlanId: 41, selectedPackageCode: 'PK-7' })
  })

  it('chọn kiện theo mã in trên nhãn', () => {
    const viewer = handle()
    registerViewer(viewer)
    expect(dispatchUiActions([{ type: 'selectPackage', packageCode: ' PK-7 ' }])).toBe(1)
    expect(viewer.select).toHaveBeenCalledWith('pl-7')
  })

  it('mã kiện phương án không có thì bỏ, không chọn gì', () => {
    const viewer = handle()
    registerViewer(viewer)
    expect(dispatchUiActions([{ type: 'selectPackage', packageCode: 'PK-404' }, { type: 'selectPackage' }])).toBe(0)
    expect(viewer.select).not.toHaveBeenCalled()
  })

  it('đang Chỉnh sửa thì bỏ mọi lệnh', () => {
    const viewer = handle({ mode: 'edit' })
    registerViewer(viewer)
    expect(dispatchUiActions([{ type: 'selectPackage', packageCode: 'PK-7' }, { type: 'setColorMode', mode: 'khoi-luong' }])).toBe(0)
    expect(viewer.select).not.toHaveBeenCalled()
    expect(viewer.setColorMode).not.toHaveBeenCalled()
  })

  it('bỏ lệnh lạ và tham số sai, giữ lệnh hợp lệ theo thứ tự', () => {
    const viewer = handle()
    registerViewer(viewer)
    const actions: UiAction[] = [
      { type: 'approvePlan' },
      { type: 'setCameraPreset', preset: 'tu-do' },
      { type: 'setStep', step: 13 },
      { type: 'setStep', step: 2.5 },
      { type: 'setColorMode', mode: 'mau-tim' },
    ]
    expect(dispatchUiActions(actions)).toBe(0)
    expect(dispatchUiActions([{ type: 'openTab', tab: 'constructor' }, { type: 'openTab', tab: 'metrics' }])).toBe(0)
    expect(dispatchUiActions([{ type: 'setStep', step: 0 }, { type: 'setCameraPreset', preset: 'gam-xe' }, { type: 'openTab', tab: 'pinned' }])).toBe(3)
    expect(viewer.setStep).toHaveBeenCalledWith(0)
    expect(viewer.setCameraPreset).toHaveBeenCalledWith('gam-xe')
    expect(viewer.setLeftTab).toHaveBeenCalledWith('pinned')
    expect(viewer.setColorMode).not.toHaveBeenCalled()
  })

  it('mỗi lượt tối đa năm lệnh', () => {
    const viewer = handle()
    registerViewer(viewer)
    const steps: UiAction[] = [1, 2, 3, 4, 5, 6, 7].map((step) => ({ type: 'setStep', step }))
    expect(dispatchUiActions(steps)).toBe(5)
    expect(viewer.setStep).toHaveBeenCalledTimes(5)
    expect(viewer.setStep).toHaveBeenLastCalledWith(5)
  })

  it('Planner đã sang phương án khác trong lúc chờ thì bỏ mọi lệnh', () => {
    const viewer = handle()
    registerViewer(viewer)
    expect(dispatchUiActions([{ type: 'setCameraPreset', preset: 'tren' }], 40)).toBe(0)
    expect(dispatchUiActions([{ type: 'setCameraPreset', preset: 'tren' }], 41)).toBe(1)
  })

  it('gỡ Planner cũ không gỡ nhầm Planner mới', () => {
    const first = handle()
    const second = handle({ loadPlanId: 42 })
    registerViewer(first)
    registerViewer(second)
    unregisterViewer(first)
    expect(viewerContext()?.loadPlanId).toBe(42)
    unregisterViewer(second)
    expect(viewerContext()).toBeNull()
  })
})
