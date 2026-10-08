import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { MOCK_DB, navigateInApp, switchUser } from './spec-flow-helpers'

/**
 * FE-BL-03: điều phối viên đổi thứ tự các điểm chưa giao của chuyến đang chạy từ màn Giám sát, rồi tài xế thấy thứ tự mới — cả luồng trên
 * **một tab**, đổi người trong app (D-95), đồng hồ của kho tua nhanh 60 lần. Chuyến thử có ba điểm và ba kiện hình lập phương cạnh 40,
 * 100, 100 cm (kiện sát cửa nhỏ hơn mặt sau của kiện ở sau nó), nên đưa điểm cuối lên trước điểm 2 chỉ che một phần lối dỡ: kho cho đổi và
 * cảnh báo. Lời từ chối khi kiện bị che kín kiểm ở `ReorderStopsDialog.dom.test.tsx` và `reorder-stops.test.ts`.
 */
test.use({ collectConsoleErrors: true })

const OPTIMIZER = '/src/services/optimization/index.ts'

/** Chuyến ba điểm của tài xế demo (`US-0004`), đã duyệt, xếp xong và vừa xuất phát; trả mã chuyến. */
async function runningTrip(page: Page): Promise<string> {
  return page.evaluate(async ({ url, optimizer, flow, samples }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const { runMockOptimization } = (await import(optimizer)) as typeof import('@/services/optimization')
    const { loadTrip } = (await import(flow)) as typeof import('@/test/trip-flow')
    const { SPEC_CARTON_A } = (await import(samples)) as typeof import('@/domain/fixtures/spec-samples')
    const db = getMockDb()
    const created = await db.createTrip({
      name: 'Tuyến đổi thứ tự', vehicleId: 'VEHICLE-005', scheduledDate: new Date(Date.now() + 7 * 3_600_000).toISOString().slice(0, 10), driverId: 'US-0004',
      stops: [
        { id: 'STOP-01', name: 'Kho Dĩ An', address: '215 Quốc lộ 1K, Dĩ An', lat: 10.8953, lng: 106.7694 },
        { id: 'STOP-02', name: 'Bách Hoá Xanh Thủ Đức', address: 'Thủ Đức', lat: 10.8494, lng: 106.7537 },
        { id: 'STOP-03', name: 'Kho Thủ Dầu Một', address: 'Thủ Dầu Một', lat: 10.9804, lng: 106.6519 },
      ],
      packages: [40, 100, 100].map((size, index) => ({ ...SPEC_CARTON_A, id: `PKG-00${index + 1}`, quantity: 1, deliveryStop: index + 1, lengthCm: size, widthCm: size, heightCm: size, weightKg: 20 })),
    })
    await db.optimizeTripRoute(created.id)
    const trip = await db.getTrip(created.id)
    const request = {
      vehicle: await db.getVehicle(trip.vehicleId),
      packages: trip.packages,
      settings: { method: 'MOCK' as const, timeLimitSeconds: 30, randomSeed: 1, enforceLifo: true, prioritizeLowCenterOfGravity: false },
    }
    const revision = await db.addRevision({ tripId: trip.id, request, result: runMockOptimization(request, { clock: () => 0 }) })
    await db.approveRevision(revision.id, [], { force: true })
    await loadTrip(db, trip.id)
    await db.startDelivery(trip.id)
    return trip.id
  }, { url: MOCK_DB, optimizer: OPTIMIZER, flow: '/src/test/trip-flow.ts', samples: '/src/domain/fixtures/spec-samples.ts' })
}

test('the dispatcher moves the last stop of a running trip up, the store keeps the cargo unloadable, and the driver sees the new order', async ({ page, login, browserErrors }) => {
  test.slow()
  await login('/giam-sat?toc-do=60')
  await expect(page.getByRole('heading', { level: 1, name: 'Giám sát', exact: true })).toBeVisible()
  const tripId = await runningTrip(page)

  const row = page.getByRole('list', { name: 'Chuyến đang vận chuyển', exact: true }).getByRole('listitem').filter({ hasText: tripId })
  await row.getByRole('button').click()
  const panel = page.getByRole('region', { name: `Giám sát chuyến ${tripId}`, exact: true })
  const stopNames = () => panel.getByRole('table', { name: 'Giờ đến từng điểm', exact: true }).getByRole('rowheader')
  await expect(stopNames()).toHaveText([/Kho Dĩ An/, /Bách Hoá Xanh Thủ Đức/, /Kho Thủ Dầu Một/])

  // Nút chỉ có ở người có quyền tối ưu tuyến; hộp liệt kê các điểm, chưa đổi gì thì chưa áp dụng được
  await panel.getByRole('button', { name: 'Đổi thứ tự điểm', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: `Đổi thứ tự điểm giao của chuyến ${tripId}`, exact: true })
  await expect(dialog.getByRole('list', { name: 'Thứ tự các điểm', exact: true }).getByRole('listitem')).toHaveCount(3)
  await expect(dialog.getByRole('button', { name: 'Áp dụng thứ tự mới', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Dời Kho Thủ Dầu Một lên', exact: true }).click()
  await dialog.getByRole('button', { name: 'Dời Kho Thủ Dầu Một lên', exact: true }).click()
  await dialog.getByRole('button', { name: 'Áp dụng thứ tự mới', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText(`Đã đổi thứ tự điểm giao của chuyến ${tripId}.`, { exact: true })).toBeVisible()
  await expect(page.getByText('1 kiện bị che một phần lối dỡ theo thứ tự mới.', { exact: true })).toBeVisible()

  // Bảng giờ đến theo thứ tự mới; phương án 3D vẫn là bản đã duyệt
  await expect(stopNames()).toHaveText([/Kho Thủ Dầu Một/, /Kho Dĩ An/, /Bách Hoá Xanh Thủ Đức/])
  await navigateInApp(page, `/chuyen/${tripId}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Tuyến đổi thứ tự', exact: true })).toBeVisible()
  await expect(page.getByText('Lỗi thời', { exact: false })).toHaveCount(0)

  // Tài xế: điểm hiện tại là điểm đầu tiên của thứ tự mới, và chuông có thông báo
  await switchUser(page, 'driver')
  await navigateInApp(page, `/tai-xe/diem-giao?chuyen=${tripId}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Điểm 1 / 3', exact: true })).toBeVisible()
  await expect(page.getByText('Kho Thủ Dầu Một', { exact: false }).first()).toBeVisible()
  await navigateInApp(page, '/tai-xe')
  await page.getByRole('button', { name: /^Thông báo, \d+ chưa đọc$/ }).click()
  await expect(page.getByRole('menu').getByRole('menuitem').filter({ hasText: 'Đổi thứ tự điểm giao khi xe đang chạy' })).toHaveCount(1)
  expect(browserErrors).toStrictEqual([])
})
