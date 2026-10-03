import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { sceneBox } from '@/test/scene'
import type { ScenePlacement, SceneStop, SceneZone } from '../scene-input'
import { DeadlinePanel, RehandlingPanel } from './PlanIndicators'

/** Seam: hai ô "Dỡ-xếp lại" và "Mức hạn" của hộp Chi tiết Planner (FE-5b-07). */
const ZONES: SceneZone[] = [
  { id: 'ZONE-1', stopId: 1, startXCm: 305, endXCm: 600, name: 'Co.opmart Bình Dương', sharePercent: 50 },
  { id: 'ZONE-2', stopId: 2, startXCm: 0, endXCm: 295, name: 'Bách Hoá Xanh Dĩ An', sharePercent: 50 },
]

function renderRehandling(zones: readonly SceneZone[], placements: readonly ScenePlacement[]) {
  render(<I18nProvider><RehandlingPanel zones={zones} placements={placements} isMockResult /></I18nProvider>)
  return within(screen.getByRole('region', { name: 'Dỡ-xếp lại' }))
}

test('rehandling counts the packages of the plan on screen that sit outside the zone of their stop, marked MOCK RESULT', () => {
  const panel = renderRehandling(ZONES, [
    sceneBox('A-01', 0, 0, 0, { stop: 2, zoneId: 'ZONE-2' }),
    sceneBox('B-01', 100, 0, 0, { stop: 1, zoneId: 'ZONE-2', outOfZone: true }),
    sceneBox('C-01', 400, 0, 0, { stop: 1, zoneId: 'ZONE-1' }),
  ])
  expect(panel.getByText('1 kiện nằm ngoài vùng của điểm giao mình')).toBeInTheDocument()
  expect(panel.getByText('MOCK RESULT')).toBeInTheDocument()
})

test('with every package in its own zone the panel says so instead of showing a zero', () => {
  const panel = renderRehandling(ZONES, [sceneBox('A-01', 0, 0, 0, { stop: 2, zoneId: 'ZONE-2' })])
  expect(panel.getByText('Không kiện nào nằm ngoài vùng của điểm giao mình.')).toBeInTheDocument()
})

test('a plan without stop zones has no rehandling figure, only the reason', () => {
  const panel = renderRehandling([], [sceneBox('A-01')])
  expect(panel.getByText('Phương án này không chia vùng theo điểm giao nên không tính được số lần dỡ-xếp lại.')).toBeInTheDocument()
  expect(panel.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  expect(panel.queryByText(/\d/)).not.toBeInTheDocument()
})

function renderDeadlines(stops: readonly SceneStop[]) {
  render(<I18nProvider><DeadlinePanel stops={stops} /></I18nProvider>)
  return within(screen.getByRole('region', { name: 'Mức hạn' }))
}

test('each stop shows its expected arrival and deadline status from the optimised route; a stop without a deadline says so', () => {
  const panel = renderDeadlines([
    { number: 1, name: 'Co.opmart Bình Dương', packageCount: 2, deadline: '2026-09-14T03:00:00.000Z', eta: '2026-09-14T02:10:00.000Z', deadlineStatus: 'OK' },
    { number: 2, name: 'Bách Hoá Xanh Dĩ An', packageCount: 1, deadline: '2026-09-14T04:00:00.000Z', eta: '2026-09-14T04:45:00.000Z', deadlineStatus: 'MISSED' },
    { number: 3, name: 'Long Châu Biên Hoà', packageCount: 4, eta: '2026-09-14T06:05:00.000Z' },
  ])
  const row = (label: string) => within(panel.getByText(label).closest('li')!)
  expect(row('Điểm 1 · Co.opmart Bình Dương').getByText('Kịp hạn')).toBeInTheDocument()
  expect(row('Điểm 1 · Co.opmart Bình Dương').getByText('Dự kiến đến 09:10 14/09/2026')).toBeInTheDocument()
  expect(row('Điểm 2 · Bách Hoá Xanh Dĩ An').getByText('Trễ hạn dự kiến')).toBeInTheDocument()
  expect(row('Điểm 3 · Long Châu Biên Hoà').getByText('Không có hạn')).toBeInTheDocument()
  expect(row('Điểm 3 · Long Châu Biên Hoà').getByText('Dự kiến đến 13:05 14/09/2026')).toBeInTheDocument()
  expect(panel.getByText('MOCK RESULT')).toBeInTheDocument()
})

test('a trip whose route is not optimised has no arrival times, only the reason', () => {
  const panel = renderDeadlines([{ number: 1, name: 'Co.opmart Bình Dương', packageCount: 2, deadline: '2026-09-14T03:00:00.000Z' }])
  expect(panel.getByText('Chuyến chưa tối ưu tuyến nên chưa có giờ đến dự kiến.')).toBeInTheDocument()
  expect(panel.queryByText('MOCK RESULT')).not.toBeInTheDocument()
  expect(panel.queryByRole('list')).not.toBeInTheDocument()
})
