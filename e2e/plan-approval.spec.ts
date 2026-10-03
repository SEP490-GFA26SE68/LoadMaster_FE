import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { navigateInApp, switchUser } from './spec-flow-helpers'
import { closeInspector, openInspector } from './viewer-helpers'

/**
 * Planner đọc revision thật và Duyệt (LM-049, LM-050): chỉ số, Duyệt tạo revision approved mới, kết quả lỗi thời chặn Duyệt.
 * LM-094: bản seed đã duyệt (REV-002) không có nút Duyệt — Duyệt đi từ revision nguồn chưa duyệt `REV-001`.
 * FE-0-07: điều phối viên là người duyệt; quản lý công ty mở cùng phương án ở chế độ chỉ xem.
 * FE-5b-08 (D-80): lý do chặn nói theo từng loại và kho tự từ chối; điểm trễ hạn dự kiến phải xác nhận rồi mới duyệt, điểm sát hạn chỉ
 * hiện; Đổi xe ở Planner và Chi tiết chuyến làm phương án lỗi thời.
 * Kho sửa trong trình duyệt qua đúng module app đang dùng; chuyển route phía client để không mất kho trong bộ nhớ.
 */
const TRIP_ID = 'TRIP-2026-0914'
const PLANNER = `/chuyen/${TRIP_ID}/phuong-an`
const SOURCE_REVISION = `${PLANNER}?revision=REV-001`
const MOCK_DB = '/src/lib/mock-db/index.ts'
const OPTIMIZATION = '/src/services/optimization/index.ts'
/** "Duyệt bởi <tên> lúc HH:mm dd/MM": điều phối viên demo (Nguyễn Thanh Tùng) duyệt cả bản seed lẫn bản vừa duyệt trong test. */
const APPROVED_BY_DISPATCHER = /Duyệt bởi Nguyễn Thanh Tùng lúc\s*\d{2}:\d{2} \d{2}\/\d{2}/

function revisionCount(page: Page) {
  return page.evaluate(async ({ url, tripId }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    return (await getMockDb().listRevisions(tripId)).length
  }, { url: MOCK_DB, tripId: TRIP_ID })
}

test('approving the seed source revision creates a new approved revision and reopens it', async ({ page, login, browserErrors }) => {
  await login(PLANNER, 'dispatcher')
  await page.locator('canvas').waitFor()
  const header = page.locator('header').first()
  await expect(header).toContainText('MOCK RESULT')
  // Người duyệt do kho ghi vào revision đã duyệt (`approvedBy`), kể cả bản seed
  await expect(header).toContainText(APPROVED_BY_DISPATCHER)
  await expect(page.getByRole('button', { name: 'Duyệt phương án', exact: true })).toHaveCount(0)

  // Tab Chỉ số: số lấy thẳng từ `result.metrics` của revision seed
  const inspector = await openInspector(page, 'metrics')
  await expect(inspector).toContainText('Chỉ số phương án')
  await expect(inspector).toContainText('Kiện đã xếp132')
  // FE-5b-03: xe của chuyến seed chưa khai trục nên không có số tải trục nào — ô Tải trục nói vì sao chưa tính
  const operations = await openInspector(page, 'operations')
  const axleLoad = operations.getByRole('region', { name: 'Tải trục', exact: true })
  await expect(axleLoad).toContainText('Chưa tính được: xe này chưa khai báo trục.')
  await expect(axleLoad).not.toContainText('kg')
  await closeInspector(page)

  await navigateInApp(page, SOURCE_REVISION)
  // V2.3 Planner3DBanChuaDuyet: bản chưa duyệt nói kho đang đọc bản nào và có lối mở bản đó
  const unapproved = page.locator('[data-planner-unapproved]')
  await expect(unapproved).toContainText('Đang xem REV-001 — kết quả tối ưu lúc')
  await expect(unapproved).toContainText('Kho và tài xế đang đọc bản đã duyệt REV-002')
  await expect(unapproved.getByRole('link', { name: 'Mở bản đã duyệt REV-002', exact: true })).toHaveAttribute('href', `${PLANNER}?revision=REV-002`)
  const before = await revisionCount(page)
  await page.getByRole('button', { name: 'Duyệt phương án', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Duyệt phương án này?' })
  await expect(dialog).toContainText('Không có lỗi chặn duyệt')
  await expect(dialog).toContainText('Không có chỉnh tay.')
  await dialog.getByRole('button', { name: 'Duyệt', exact: true }).click()
  await expect(page.getByText('Đã duyệt phương án.')).toBeVisible()
  await page.waitForURL(/\/phuong-an\?revision=REV-(?!001)/)
  expect(await revisionCount(page)).toBe(before + 1)
  await expect(header).toContainText(APPROVED_BY_DISPATCHER)
  expect(browserErrors).toStrictEqual([])
})

test('changing cargo after optimisation marks the plan stale and blocks approval; the company manager only reads it', async ({ page, login }) => {
  // Sửa kho trước khi Planner đọc (Query giữ dữ liệu 30 s)
  await login('/doi-xe', 'dispatcher')
  await page.evaluate(async ({ url, tripId }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    const trip = await db.getTrip(tripId)
    await db.updateTrip(tripId, { packages: trip.packages.map((pkg, i) => i === 0 ? { ...pkg, weightKg: pkg.weightKg + 1 } : pkg) })
  }, { url: MOCK_DB, tripId: TRIP_ID })
  await navigateInApp(page, PLANNER)

  const stale = page.getByRole('alert').filter({ hasText: 'Kết quả đã lỗi thời' })
  await expect(stale).toBeVisible()
  // V2.3 Planner3DLoiThoi: thanh nói lần sửa nào làm lỗi thời (trường, trước → sau) và việc phải làm trước khi kho xếp
  await expect(stale).toContainText(/Sau lần tối ưu \d{2}:\d{2} · \d{2}\/\d{2}: PKG-\S+ .+ · Khối lượng /)
  await expect(stale).toContainText('Kho chỉ xếp được khi điều phối viên tối ưu lại và duyệt.')
  await expect(page.getByRole('link', { name: 'Tới Thiết lập tối ưu' })).toHaveAttribute('href', `/chuyen/${TRIP_ID}/toi-uu`)
  // Bản đã duyệt không có nút Duyệt (LM-094); revision nguồn chưa duyệt thì có, kèm lý do chặn trong nút và hộp thoại
  await expect(page.getByRole('button', { name: 'Duyệt phương án', exact: true })).toHaveCount(0)
  await navigateInApp(page, SOURCE_REVISION)
  const approve = page.getByRole('button', { name: 'Duyệt phương án', exact: true })
  await expect(approve).toHaveAccessibleDescription('Chưa duyệt được: kết quả lỗi thời.')
  // U-5: lý do không còn là chữ đỏ chen trong thanh trên mà nằm ở tooltip của nút
  await expect(page.locator('header').first().locator('.text-badge-danger-fg')).toHaveCount(0)
  await approve.hover()
  await expect(page.getByRole('tooltip')).toHaveText('Chưa duyệt được: kết quả lỗi thời.')
  await approve.click()
  const dialog = page.getByRole('dialog', { name: 'Duyệt phương án này?' })
  await expect(dialog).toContainText('Kết quả lỗi thời — chạy tối ưu lại trước khi duyệt.')
  await expect(dialog.getByRole('button', { name: 'Duyệt', exact: true })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Huỷ', exact: true }).click()
  await expect(dialog).toBeHidden()

  // Quản lý công ty đăng nhập ngay trong app (tải lại là mất lần sửa kiện): cùng thanh lỗi thời, nhưng chỉ xem — không có lối sang
  // Thiết lập tối ưu, không có nút Duyệt kể cả ở bản nguồn chưa duyệt
  await switchUser(page, 'manager')
  await navigateInApp(page, SOURCE_REVISION)
  await expect(stale).toBeVisible()
  await expect(page.locator('[data-planner-lock="readOnly"]')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Tới Thiết lập tối ưu' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Duyệt phương án', exact: true })).toHaveCount(0)
})

test('a plan with a must-load line left behind and an overloaded axle names both reasons, cannot be approved, and the store refuses it too (FE-5b-08)', async ({ page, login }) => {
  await login('/doi-xe', 'dispatcher')
  // Bản mới của TRIP-012 dựng từ bản seed: kiện xếp sau cùng thành "chưa xếp" và dòng của nó là bắt buộc; xe khai hai trục với giới
  // hạn trục trước thấp hơn tải rỗng + hàng
  const revisionId = await page.evaluate(async (url) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    const [source] = await db.listRevisions('TRIP-012')
    if (!source) throw new Error('TRIP-012 has no revision')
    const last = source.result.placements.toSorted((a, b) => b.loadingOrder - a.loadingOrder)[0]!
    const lineId = last.packageInstanceId.slice(0, last.packageInstanceId.lastIndexOf('-'))
    const revision = await db.addRevision({
      tripId: 'TRIP-012',
      request: {
        ...source.request,
        packages: source.request.packages.map((pkg) => (pkg.id === lineId ? { ...pkg, mustLoad: true } : pkg)),
        vehicle: {
          ...source.request.vehicle,
          axles: [
            { id: 'AXLE-1', name: 'Trục trước', positionXCm: -120, emptyLoadKg: 1800, maxLoadKg: 1810 },
            { id: 'AXLE-2', name: 'Trục sau', positionXCm: 380, emptyLoadKg: 1200, maxLoadKg: 9000 },
          ],
        },
      },
      result: {
        ...source.result,
        placements: source.result.placements.filter((placement) => placement !== last),
        unplacedPackages: [{ packageInstanceId: last.packageInstanceId, reasonCode: 'NO_SPACE', message: 'NO_SPACE' }],
      },
    })
    return revision.id
  }, MOCK_DB)
  await navigateInApp(page, `/chuyen/TRIP-012/phuong-an?revision=${revisionId}`)
  await page.locator('canvas').waitFor()

  const reason = 'Chưa duyệt được: 1 dòng kiện bắt buộc chưa xếp đủ và tải trục vượt giới hạn.'
  const approve = page.getByRole('button', { name: 'Duyệt phương án', exact: true })
  await expect(approve).toHaveAccessibleDescription(reason)
  await approve.hover()
  await expect(page.getByRole('tooltip')).toHaveText(reason)
  await approve.click()
  const dialog = page.getByRole('dialog', { name: 'Duyệt phương án này?' })
  await expect(dialog.getByRole('alert').getByRole('listitem')).toHaveCount(2)
  await expect(dialog.getByRole('button', { name: 'Duyệt', exact: true })).toBeDisabled()

  // Bỏ qua giao diện, gọi thẳng kho: vẫn bị từ chối, kể cả khi gửi `force`
  const refused = await page.evaluate(async ({ url, id }) => {
    const { getMockDb, isMockDbError } = (await import(url)) as typeof import('@/lib/mock-db')
    try {
      await getMockDb().approveRevision(id, [], { force: true })
      return 'approved'
    } catch (error) {
      return isMockDbError(error) ? `${error.code} ${JSON.stringify(error.params)}` : 'unknown'
    }
  }, { url: MOCK_DB, id: revisionId })
  expect(refused).toBe(`APPROVAL_BLOCKED ${JSON.stringify({ revisionId, count: 2, codes: ['AXLE_OVERLOAD', 'MUST_LOAD_UNPLACED'] })}`)
})

test('a stop expected to miss its deadline must be confirmed before approval; a stop close to its deadline is only shown (FE-5b-08)', async ({ page, login }) => {
  await login('/doi-xe', 'dispatcher')
  // Chuyến một điểm giao từ yêu cầu REQ-006, xuất phát 08:00 sau hai ngày, đã tối ưu tuyến; hạn 08:01 sớm hơn mọi giờ đến
  const { tripId, sourceId, stopName } = await page.evaluate(async ({ url, service }) => {
    const { getMockDb, addDays, vnDate } = (await import(url)) as typeof import('@/lib/mock-db')
    const { runMockOptimization } = (await import(service)) as typeof import('@/services/optimization')
    const db = getMockDb()
    const day = addDays(vnDate(new Date()), 2)
    const created = await db.createTrip({ name: 'Tuyến Dĩ An sáng', vehicleId: 'VEHICLE-005', scheduledDate: day, packages: [], stops: [] })
    await db.assignDeliveryRequirement('REQ-006', created.id)
    await db.optimizeTripRoute(created.id)
    await db.updateDeliveryRequirement('REQ-006', { deadline: `${day}T08:01:00+07:00` })
    const trip = await db.getTrip(created.id)
    const request = {
      vehicle: await db.getVehicle(trip.vehicleId),
      packages: trip.packages,
      settings: { method: 'MOCK' as const, timeLimitSeconds: 30, randomSeed: 20_260_916, enforceLifo: true, prioritizeLowCenterOfGravity: false },
    }
    const revision = await db.addRevision({ tripId: trip.id, request, result: runMockOptimization(request) })
    return { tripId: trip.id, sourceId: revision.id, stopName: trip.stops[0]!.name }
  }, { url: MOCK_DB, service: OPTIMIZATION })
  const revisions = () => page.evaluate(async ({ url, id }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    return (await getMockDb().listRevisions(id)).length
  }, { url: MOCK_DB, id: tripId })

  await navigateInApp(page, `/chuyen/${tripId}/phuong-an`)
  await page.locator('canvas').waitFor()
  await page.getByRole('button', { name: 'Duyệt phương án', exact: true }).click()
  const review = page.getByRole('dialog', { name: 'Duyệt phương án này?' })
  await expect(review).toContainText('Không có lỗi chặn duyệt')
  await expect(review).toContainText('1 điểm giao trễ hạn dự kiến — cần xác nhận khi duyệt.')
  await review.getByRole('button', { name: 'Duyệt', exact: true }).click()

  // Bước xác nhận: điểm, giờ đến dự kiến và hạn; chưa có gì được duyệt
  const confirm = page.getByRole('dialog', { name: 'Duyệt dù có điểm trễ hạn?' })
  const late = confirm.getByRole('list', { name: 'Điểm giao trễ hạn dự kiến' }).getByRole('listitem')
  await expect(late).toHaveCount(1)
  await expect(late).toContainText(`Điểm 1 · ${stopName}`)
  await expect(late).toContainText(/Dự kiến đến \d{2}:\d{2} \d{2}\/\d{2} · hạn \d{2}:\d{2} \d{2}\/\d{2}/)
  await expect(confirm).toContainText('MOCK RESULT')
  expect(await revisions()).toBe(1)
  await confirm.getByRole('button', { name: 'Quay lại', exact: true }).click()
  await expect(review).toBeVisible()
  expect(await revisions()).toBe(1)

  await review.getByRole('button', { name: 'Duyệt', exact: true }).click()
  await confirm.getByRole('button', { name: 'Vẫn duyệt', exact: true }).click()
  await expect(page.getByText('Đã duyệt phương án.')).toBeVisible()
  await page.waitForURL((url) => /^REV-/.test(url.searchParams.get('revision') ?? '') && url.searchParams.get('revision') !== sourceId)
  expect(await revisions()).toBe(2)
  // Nhật ký ghi lần duyệt có một điểm trễ hạn dự kiến đã được xác nhận
  const approvedParams = await page.evaluate(async ({ url, id }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const [event] = await getMockDb().listEvents({ targetId: id })
    return [event?.action, event?.params.lateStops]
  }, { url: MOCK_DB, id: tripId })
  expect(approvedParams).toStrictEqual(['revision.approved', 1])

  // Hạn dời ra sau giờ đến 10 phút: điểm sát hạn — hộp duyệt chỉ hiện, bấm Duyệt là duyệt
  await page.evaluate(async ({ url, id }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    const eta = (await db.getTrip(id)).routePlan!.stops[0]!.eta
    await db.updateDeliveryRequirement('REQ-006', { deadline: new Date(Date.parse(eta) + 10 * 60_000).toISOString() })
  }, { url: MOCK_DB, id: tripId })
  await navigateInApp(page, `/chuyen/${tripId}/phuong-an?revision=${sourceId}`)
  await page.locator('canvas').waitFor()
  await page.getByRole('button', { name: 'Duyệt phương án', exact: true }).click()
  await expect(review).toContainText('1 điểm giao sát hạn (không chặn duyệt).')
  await expect(review).toContainText(`Điểm 1 · ${stopName}`)
  await expect(review).not.toContainText('trễ hạn dự kiến')
  await review.getByRole('button', { name: 'Duyệt', exact: true }).click()
  await expect(confirm).toHaveCount(0)
  await expect.poll(revisions).toBe(3)
})

test('changing the vehicle from the Planner and from trip detail offers only ready vehicles that take the cargo and makes the plan stale (FE-5b-08)', async ({ page, login, browserErrors }) => {
  await login(PLANNER, 'dispatcher')
  await page.locator('canvas').waitFor()
  await expect(page.getByRole('alert').filter({ hasText: 'Kết quả đã lỗi thời' })).toHaveCount(0)
  // Nút phụ ở góc khung 3D, không nằm trên thanh trên (hàng điều khiển không còn chỗ, `planner-compact`)
  await expect(page.locator('header').first().getByRole('button', { name: 'Đổi xe', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Đổi xe', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: `Đổi xe của chuyến ${TRIP_ID}` })
  await expect(dialog).toContainText('Hàng của chuyến: 132 kiện · 5.844 kg · 16,6 m³')
  // Xe thiếu tải, xe đang chạy chuyến và xe bảo dưỡng bị khoá kèm lý do ngay tại dòng
  const vehicle = (name: RegExp) => dialog.getByRole('radio', { name })
  await expect(vehicle(/Truck 6m/)).toBeDisabled()
  await expect(vehicle(/Truck 6m/)).toHaveAccessibleDescription('Hàng nặng 5.844 kg, vượt tải trọng 5.000 kg.')
  await expect(vehicle(/Isuzu FVR 900/)).toHaveAccessibleDescription('Đang phục vụ chuyến TRIP-011.')
  await expect(vehicle(/Hyundai Mighty EX8/)).toHaveAccessibleDescription('Đang bảo dưỡng.')
  await expect(vehicle(/Hyundai HD210/)).toHaveAccessibleDescription('Xe đang dùng cho chuyến này.')
  const submit = dialog.getByRole('button', { name: 'Đổi xe', exact: true })
  await expect(submit).toBeDisabled()
  await vehicle(/Hino FC9J đông lạnh/).click()
  await submit.click()
  await expect(page.getByText(`Đã đổi xe của chuyến ${TRIP_ID}. Phương án xếp hàng hiện tại đã lỗi thời.`)).toBeVisible()
  await expect(dialog).toBeHidden()

  // Phương án đang xem thành lỗi thời ngay, thanh thông báo nói lần đổi xe là lý do
  const stale = page.getByRole('alert').filter({ hasText: 'Kết quả đã lỗi thời' })
  await expect(stale).toBeVisible()
  await expect(stale).toContainText(/đã sửa Xe \(\d{2}:\d{2} · \d{2}\/\d{2} · Nguyễn Thanh Tùng\)/)
  await navigateInApp(page, SOURCE_REVISION)
  await expect(page.getByRole('button', { name: 'Duyệt phương án', exact: true })).toHaveAccessibleDescription('Chưa duyệt được: kết quả lỗi thời.')
  const changed = await page.evaluate(async ({ url, tripId }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    const [event] = await db.listEvents({ targetId: tripId })
    return [(await db.getTrip(tripId)).vehicleId, event?.action, event?.params]
  }, { url: MOCK_DB, tripId: TRIP_ID })
  expect(changed).toStrictEqual(['VEHICLE-004', 'trip.vehicleChanged', { fields: 'vehicleId', before: 'VEHICLE-002', after: 'VEHICLE-004' }])

  // Chi tiết chuyến của một chuyến Đã lập kế hoạch khác: mục Phương tiện mở cùng hộp thoại
  await navigateInApp(page, '/chuyen/TRIP-012')
  const vehicleCard = page.getByRole('region', { name: 'Phương tiện', exact: true })
  await expect(vehicleCard).toContainText('Hino XZU720')
  await vehicleCard.getByRole('button', { name: 'Đổi xe', exact: true }).click()
  const second = page.getByRole('dialog', { name: 'Đổi xe của chuyến TRIP-012' })
  // Xe vừa nhường lại ở chuyến chính (Hyundai HD210) sẵn sàng và đủ tải cho 2.100 kg hàng của TRIP-012
  await second.getByRole('radio', { name: /Hyundai HD210/ }).click()
  await second.getByRole('button', { name: 'Đổi xe', exact: true }).click()
  await expect(page.getByText('Đã đổi xe của chuyến TRIP-012. Phương án xếp hàng hiện tại đã lỗi thời.')).toBeVisible()
  await expect(vehicleCard).toContainText('Hyundai HD210')
  await expect(page.getByText('Lỗi thời — cần tối ưu lại', { exact: true }).first()).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
