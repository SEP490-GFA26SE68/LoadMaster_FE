import { expect, test } from 'vitest'
import type { VehicleConfig } from '@/domain/models'
import type { LoadPlan, LoadPlacement } from '@/features/optimization/load-plan-dto'
import { backendPlacementIds, backendPlanScene } from '../backend-plan-scene'
import { createViewerDraft, patchPlacement, resolveEffectiveScene } from '../viewer-draft'
import { backendEditApproval, baselineErrorKeys } from './backend-edit-approval'

/**
 * "Duyệt bản chỉnh" của Planner bản máy chủ: patch của draft đi theo mã số chỗ xếp của máy chủ, và chỉ lỗi ràng buộc mới do bản chỉnh gây
 * ra mới chặn gửi — lỗi có sẵn trong phương án máy chủ đã nhận thì không.
 */
const VEHICLE: VehicleConfig = {
  id: '7', name: 'Xe tải 1,5 tấn', innerLengthCm: 400, innerWidthCm: 200, innerHeightCm: 200, maxPayloadKg: 1500,
  doorWidthCm: 200, doorHeightCm: 200, doorPosition: 'REAR', clearanceCm: 0, obstacles: [],
}

const placement = (id: string, code: string, x: number, over: Partial<LoadPlacement> = {}): LoadPlacement => ({
  id, packageId: `P${id}`, code, weightKg: 20, x, y: 0, z: 0, lengthCm: 100, widthCm: 50, heightCm: 40,
  rotationType: 0, step: Number(id) - 10, pinned: false, stopId: '91', stopSequence: 1, ...over,
})

const plan = (placements: LoadPlacement[], over: Partial<LoadPlan> = {}): LoadPlan => ({
  id: '501', tripId: '42', jobId: 'job-1', objective: 'MAX_VOLUME', label: 'A', algorithmName: 'EP_DBLF', computationMs: null,
  name: null, volumePercent: null, payloadPercent: null, approved: true, approvedByName: null, centerOfGravityCm: null,
  frontAxleLoadKg: null, rearAxleLoadKg: null, rehandlingCount: null, manuallyEdited: false, stale: false,
  placements, unplaced: [], ...over,
})

const STOPS = [{ id: '91', sequence: 1, name: 'Cửa hàng Thủ Đức', deadline: null }]

function approvalAfterMove(source: LoadPlan, id: string, position: { x: number; y: number; z: number }) {
  const model = backendPlanScene({ tripCode: 'TRIP-1', plan: source, vehicle: VEHICLE, stops: STOPS })
  const draft = patchPlacement(model, createViewerDraft(), id, { position })
  const { placements } = resolveEffectiveScene(model, draft)
  return backendEditApproval(model, placements, draft, backendPlacementIds(source), baselineErrorKeys(model))
}

test('dời kiện vào chỗ trống: một chỉnh sửa theo mã số chỗ xếp, không lỗi, ghim giữ nguyên', () => {
  const approval = approvalAfterMove(plan([placement('11', 'PK-1', 0), placement('12', 'PK-2', 100)]), 'PK-2', { x: 250, y: 100, z: 0 })
  expect(approval?.edits).toEqual([{ placementId: '12', x: 250, y: 100, z: 0, rotationType: 0 }])
  expect(approval?.errors).toEqual([])
  expect(approval?.hasEdits).toBe(true)
  expect(approval?.pinnedPlacementIds).toBeUndefined()
})

test('dời kiện chồng lên kiện khác: lỗi chồng lấn mới chặn gửi', () => {
  const approval = approvalAfterMove(plan([placement('11', 'PK-1', 0), placement('12', 'PK-2', 100)]), 'PK-2', { x: 50, y: 0, z: 0 })
  expect(approval?.errors.map(({ code }) => code)).toContain('OVERLAP')
})

test('lỗi có sẵn trong phương án máy chủ không chặn bản chỉnh không đụng tới nó', () => {
  // PK-1 và PK-2 đã chồng nhau trong phương án máy chủ; dời PK-3 sang chỗ trống không gây lỗi mới
  const source = plan([placement('11', 'PK-1', 0), placement('12', 'PK-2', 50), placement('13', 'PK-3', 200)])
  const approval = approvalAfterMove(source, 'PK-3', { x: 300, y: 0, z: 0 })
  expect(approval?.edits.map(({ placementId }) => placementId)).toEqual(['13'])
  expect(approval?.errors).toEqual([])
})

test('phương án máy chủ có cờ lỗi thời và chỉnh tay; kiện chưa xếp mang kích thước máy chủ trả', () => {
  const model = backendPlanScene({
    tripCode: 'TRIP-1', vehicle: VEHICLE, stops: STOPS,
    plan: plan([placement('11', 'PK-1', 0)], {
      stale: true, manuallyEdited: true,
      unplaced: [{ packageId: '302', code: 'PK-302', reason: 'OVER_WEIGHT', size: { lengthCm: 120, widthCm: 80, heightCm: 60 }, weightKg: 45 }],
    }),
  })
  expect(model.revision).toMatchObject({ stale: true, manuallyEdited: true })
  expect(model.engineInput?.placements.map(({ packageInstanceId }) => packageInstanceId)).toEqual(['PK-1'])
  expect(model.unplaced[0]).toMatchObject({ lengthCm: 120, widthCm: 80, heightCm: 60, weightKg: 45 })
  expect(model.unplaced[0]?.detailUnknown).toBeFalsy()
})
