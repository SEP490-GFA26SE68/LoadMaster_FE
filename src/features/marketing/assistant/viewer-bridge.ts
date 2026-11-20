import type { LeftTab } from '@/features/viewer3d/useLoadPlanViewer'
import { CAMERA_PRESETS, COLOR_MODES } from '@/features/viewer3d/viewer-options'
import type { CameraPreset, ColorMode } from '@/features/viewer3d/viewer-types'
import type { UiAction } from './assistant-api'

/**
 * Cầu nối giữa khung chat của trợ lý và Planner bản máy chủ (kỹ năng hỏi về phương án 3D). Planner đăng ký một `ViewerHandle` khi mở
 * (`registerViewer`) và gỡ khi rời (`unregisterViewer`); khung chat đọc ngữ cảnh để gửi kèm câu hỏi (`viewerContext`) và chuyển lệnh giao diện
 * của câu trả lời vừa về cho Planner (`dispatchUiActions`). Module thuần: không React, không Three.js.
 *
 * Máy chủ đã lọc lệnh theo danh sách cho phép; ở đây kiểm lần nữa: lệnh lạ hay tham số sai bị bỏ im lặng (không toast), mỗi lượt tối đa
 * `MAX_UI_ACTIONS` lệnh, đang Chỉnh sửa hay không có Planner thì bỏ mọi lệnh. Không có lệnh dời, xoay, ghim hay duyệt.
 */
export type ViewerContext = {
  readonly tripCode: string
  /** Mã số phương án của máy chủ. */
  readonly loadPlanId: number
  /** Mã kiện (mã in trên nhãn) đang chọn trên khung 3D. */
  readonly selectedPackageCode: string | null
}

export type ViewerHandle = ViewerContext & {
  readonly mode: 'view' | 'edit'
  /** Số bước xếp của phương án — `setStep` nhận 0…`totalSteps`. */
  readonly totalSteps: number
  /** Mã kiện → mã placement trên khung 3D; `null` khi phương án không có (hay có nhiều hơn một) kiện mang mã đó. */
  placementIdOf(packageCode: string): string | null
  select(placementId: string): void
  setCameraPreset(preset: CameraPreset): void
  setStep(step: number): void
  setColorMode(mode: ColorMode): void
  /** Mở danh sách kiện của hộp thông tin ở khối chưa xếp / đã ghim / đã xếp. */
  setLeftTab(tab: LeftTab): void
}

export const MAX_UI_ACTIONS = 5

/** Bản ghi đủ ba khối: thêm khối vào `LeftTab` mà quên ở đây là lỗi kiểu. */
const LEFT_TABS: Readonly<Record<LeftTab, true>> = { unplaced: true, pinned: true, placed: true }

let current: ViewerHandle | null = null

export function registerViewer(handle: ViewerHandle): void {
  current = handle
}

/** Gỡ Planner; có `handle` thì chỉ gỡ khi đó đúng là Planner đang đăng ký. */
export function unregisterViewer(handle?: ViewerHandle): void {
  if (handle === undefined || current === handle) current = null
}

/** Ngữ cảnh gửi kèm câu hỏi; `null` khi không có Planner máy chủ nào đang mở. */
export function viewerContext(): ViewerContext | null {
  if (current === null) return null
  const { tripCode, loadPlanId, selectedPackageCode } = current
  return { tripCode, loadPlanId, selectedPackageCode }
}

const isPreset = (value: unknown): value is CameraPreset => typeof value === 'string' && (CAMERA_PRESETS as readonly string[]).includes(value)
const isColorMode = (value: unknown): value is ColorMode => typeof value === 'string' && (COLOR_MODES as readonly string[]).includes(value)
const isLeftTab = (value: unknown): value is LeftTab => typeof value === 'string' && Object.hasOwn(LEFT_TABS, value)

/** Một lệnh đã kiểm thành lời gọi trên Planner; `null` là bỏ. */
function commandOf(action: UiAction, handle: ViewerHandle): (() => void) | null {
  switch (action.type) {
    case 'selectPackage': {
      const code = typeof action.packageCode === 'string' ? action.packageCode.trim() : ''
      const id = code === '' ? null : handle.placementIdOf(code)
      return id === null ? null : () => handle.select(id)
    }
    case 'setCameraPreset': {
      const { preset } = action
      return isPreset(preset) ? () => handle.setCameraPreset(preset) : null
    }
    case 'setStep': {
      const { step } = action
      return Number.isInteger(step) && step !== undefined && step >= 0 && step <= handle.totalSteps ? () => handle.setStep(step) : null
    }
    case 'setColorMode': {
      const { mode } = action
      return isColorMode(mode) ? () => handle.setColorMode(mode) : null
    }
    case 'openTab': {
      const { tab } = action
      return isLeftTab(tab) ? () => handle.setLeftTab(tab) : null
    }
    default:
      return null
  }
}

/**
 * Thực hiện lệnh giao diện của câu trả lời vừa về, theo thứ tự, trên Planner đang mở. `loadPlanId`: phương án câu hỏi đã gửi kèm — Planner
 * đã đổi sang phương án khác (hay đã đóng) trong lúc chờ thì bỏ mọi lệnh. Trả số lệnh đã thực hiện.
 */
export function dispatchUiActions(actions: readonly UiAction[], loadPlanId?: number): number {
  const handle = current
  if (handle === null || handle.mode === 'edit') return 0
  if (loadPlanId !== undefined && loadPlanId !== handle.loadPlanId) return 0
  let done = 0
  for (const action of actions.slice(0, MAX_UI_ACTIONS)) {
    const command = commandOf(action, handle)
    if (command === null) continue
    command()
    done += 1
  }
  return done
}
