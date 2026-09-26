import { attachJson, expect, test } from './fixtures'
import { addPackage, heightOf, MOCK_DB, navigateInApp, optimizeAndOpenPlanner, SEED_TRIP } from './spec-flow-helpers'
import { cameraPreset, closeInspector, openInspector, renderCameraChange, sceneSnapshot, waitCameraSettled } from './viewer-helpers'

/**
 * Luồng Spec đầu cuối (LM-054, Spec mục 15 và 16). Mỗi assertion gắn một dòng checklist Spec §15 ghi dạng
 * `§15 "<dòng>"`. Dữ liệu chỉ tạo qua UI trên kho in-memory của trang, không tải lại trang sau khi đã ghi.
 */

test.use({ collectConsoleErrors: true })

for (const device of ['desktop', 'tablet'] as const) {
  const details = device === 'tablet' ? { tag: '@tablet' } : {}

  test(`${device}: dashboard to approved plan to warehouse step`, details, async ({ page, login, browserErrors }, testInfo) => {
    const tablet = device === 'tablet'
    // Chiều cao nút chính trên tablet, đính kèm báo cáo. Màn điều phối (form chuyến, Thiết lập tối ưu, hộp Duyệt) còn 40 px:
    // ghi ở LM-054, không khẳng định ở đây. Màn 3D và màn kho là màn cảm ứng: khẳng định ≥ 56 px (AGENTS mục 5, 10).
    const heights: Record<string, number> = {}

    // Xe "Truck 6m" có hốc bánh xe, tạo ở Đội xe
    await login('/doi-xe', 'admin')
    await page.getByRole('link', { name: 'Thêm xe', exact: true }).click()
    await page.getByRole('textbox', { name: 'Tên xe *' }).fill('Truck 6m')
    // §15 "Tạo xe bằng cm/kg" + "Mọi field hiển thị đơn vị": ô lòng thùng là cm, tải trọng là kg
    const lengthField = page.getByRole('spinbutton', { name: 'Chiều dài lòng thùng', exact: true })
    await expect(lengthField).toHaveValue('600')
    await expect(lengthField.locator('xpath=..')).toContainText('cm')
    await expect(page.getByRole('spinbutton', { name: 'Tải trọng tối đa', exact: true }).locator('xpath=..')).toContainText('kg')
    await page.getByRole('button', { name: 'Thêm vật cản', exact: true }).click()
    // Loại mặc định của dòng vật cản mới là hốc bánh xe (WHEEL_ARCH)
    await expect(page.getByRole('combobox', { name: 'Loại OBS-001', exact: true })).toHaveText('Hốc bánh xe')
    await expect(page.getByRole('spinbutton', { name: 'Dài OBS-001', exact: true }).locator('xpath=..')).toContainText('cm')
    await page.getByRole('button', { name: 'Lưu', exact: true }).click()
    await page.waitForURL(/\/doi-xe$/)
    // Seed có 8 xe (LM-083) nên xe mới là VEHICLE-009; cột theo V2: tên · lòng thùng · tải · vật cản · trạng thái cuối
    await expect(page.getByRole('row', { name: /Truck 6m VEHICLE-009 600 × 240 × 250 cm 5\.000 kg 1 vùng Sẵn sàng/ })).toBeVisible()

    // Dashboard → Tạo kế hoạch xếp → form chuyến
    await page.getByRole('link', { name: 'Bảng điều khiển', exact: true }).click()
    await page.getByRole('link', { name: 'Tạo kế hoạch xếp', exact: true }).click()
    await page.waitForURL(/\/chuyen\/moi$/)
    await page.getByRole('textbox', { name: 'Tên chuyến', exact: true }).fill('Tuyến Dĩ An E2E')
    await page.getByRole('combobox', { name: 'Xe', exact: true }).click()
    // Seed cũng có một xe tên "Truck 6m"; xe vừa tạo đứng cuối danh sách
    await page.getByRole('option', { name: 'Truck 6m', exact: true }).last().click()
    await page.getByRole('textbox', { name: 'Tên điểm giao 1', exact: true }).fill('Kho Bình Dương')
    const createTrip = page.getByRole('button', { name: 'Tạo chuyến', exact: true })
    if (tablet) heights.createTrip = await heightOf(createTrip)
    await createTrip.click()
    await page.waitForURL(/\/chuyen\/TRIP-015$/)
    await expect(page.getByText('Đã tạo chuyến TRIP-015')).toBeVisible()

    // Kiện PKG-001 × 4, rồi nhân bản
    const panel = await addPackage(page, { name: 'Thùng sơn', lengthCm: 120, widthCm: 100, heightCm: 100, weightKg: 200, quantity: 4 })
    // §15 "Mọi field hiển thị đơn vị": form kiện
    await expect(page.getByRole('row', { name: /Thùng sơn PKG-001 · 120 × 100 × 100 cm 200 kg 4/ })).toBeVisible()
    await expect(page.getByText('Đã lưu kiện PKG-001')).toBeVisible()
    // §15 "Tự tính tổng khối lượng và thể tích": 4 × 1,2 m³ và 4 × 200 kg
    await expect(page.getByText(/Kiện\s*4\s*Thể tích\s*4,8 m³\s*Khối lượng\s*800 kg/)).toBeVisible()
    await page.getByRole('row', { name: /PKG-001/ }).click()
    const editPanel = page.getByRole('complementary', { name: 'Kiện PKG-001' })
    await expect(editPanel.getByRole('spinbutton', { name: 'Dài', exact: true }).locator('xpath=..')).toContainText('cm')
    await expect(editPanel.getByRole('spinbutton', { name: 'Khối lượng', exact: true }).locator('xpath=..')).toContainText('kg')
    // §15 "Thêm/sửa/xóa/nhân bản kiện": nhân bản
    await editPanel.getByRole('button', { name: 'Nhân bản', exact: true }).click()
    await expect(page.getByText('Đã tạo bản sao PKG-002')).toBeVisible()
    await expect(page.getByRole('row', { name: /Thùng sơn PKG-002 · 120 × 100 × 100 cm 200 kg 4/ })).toBeVisible()
    await expect(page.getByText(/Kiện\s*8\s*Thể tích\s*9,6 m³\s*Khối lượng\s*1\.600 kg/)).toBeVisible()
    await expect(panel).toHaveCount(0)

    // Thiết lập tối ưu → Tối ưu → Planner
    await page.getByRole('link', { name: 'Chạy tối ưu', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Thiết lập tối ưu', exact: true })).toBeVisible()
    await expect(page.getByText('Không có lỗi — có thể tối ưu.')).toBeVisible()
    const optimize = page.getByRole('button', { name: 'Tối ưu', exact: true })
    if (tablet) heights.optimize = await heightOf(optimize)
    await optimizeAndOpenPlanner(page)

    const header = page.locator('header').first()
    // §15 "Mock result có nhãn rõ ràng"
    await expect(header).toContainText('MOCK RESULT')
    // §15 "Hiển thị volume/payload utilization": 8 × 1,2 m³ / (600 × 240 × 250 cm) = 26,7 %; 1.600 / 5.000 kg = 32,0 %
    await expect(header).toContainText(/Thể tích\s*26,7%/)
    await expect(header).toContainText(/Tải trọng\s*32,0%/)
    // §15 "Quantity được mở rộng thành instance riêng": 2 dòng × 4 = 8 kiện đã xếp
    await expect(header).toContainText(/Đã xếp\s*8 \/ 8/)
    // §15 "Viewer hiển thị đúng tỷ lệ xe, hàng và obstacle": vật cản của xe vừa tạo, đúng góc và kích thước cm
    await expect(page.getByRole('list', { name: 'Vật cản trong thùng' }))
      .toContainText('Hốc bánh xe OBS-001: Góc tại X 0 cm · Y 0 cm · Z 0 cm, kích thước 100 × 25 × 30 cm')

    const approve = page.getByRole('button', { name: 'Duyệt phương án', exact: true })
    if (tablet) {
      heights.approve = await heightOf(approve)
      expect(heights.approve, 'Planner primary button is a 56 px touch target').toBeGreaterThanOrEqual(56)
    }

    if (!tablet) {
      // §15 "Rotate, zoom, pan và reset camera hoạt động"
      await waitCameraSettled(page)
      const initial = await sceneSnapshot(page)
      const canvas = (await page.locator('canvas').boundingBox())!
      const centre = { x: canvas.x + canvas.width * 0.6, y: canvas.y + canvas.height * 0.5 }
      await renderCameraChange(page, async () => {
        await page.mouse.move(centre.x, centre.y)
        await page.mouse.down()
        await page.mouse.move(centre.x + 120, centre.y + 30, { steps: 8 })
        await page.mouse.up()
      })
      const rotated = await sceneSnapshot(page)
      expect(rotated.direction, 'rotate').not.toStrictEqual(initial.direction)
      await renderCameraChange(page, async () => {
        await page.mouse.move(centre.x, centre.y)
        await page.mouse.wheel(0, -400)
      })
      await renderCameraChange(page, async () => {
        await page.mouse.move(centre.x, centre.y)
        await page.mouse.down({ button: 'right' })
        await page.mouse.move(centre.x + 80, centre.y + 40, { steps: 8 })
        await page.mouse.up({ button: 'right' })
      })
      expect((await sceneSnapshot(page)).target, 'pan').not.toStrictEqual(rotated.target)
      // Góc nhìn là Select Radix trên thanh công cụ (LM-094)
      await renderCameraChange(page, () => cameraPreset(page, 'Trên'))
      await renderCameraChange(page, () => cameraPreset(page, 'Góc chéo'))
      const reset = await sceneSnapshot(page)
      reset.direction.forEach((value, axis) => expect(value, 'reset').toBeCloseTo(initial.direction[axis]!, 2))
    }

    // §15 "Click kiện hiển thị đúng thông tin cm/kg"
    const inspector = await openInspector(page, 'package')
    await inspector.getByRole('combobox', { name: 'Chọn kiện', exact: true }).selectOption('PKG-001-02')
    const selected = inspector.getByRole('complementary', { name: 'Kiện đang chọn' })
    await expect(selected.getByRole('heading', { name: 'PKG-001-02' })).toBeVisible()
    await expect(selected).toContainText(/Kích thước \(D × R × C\)\s*120 × 100 × 100 cm/)
    await expect(selected).toContainText(/Khối lượng\s*200,0 kg/)
    // §15 "Hai kiện chạm mặt không bị báo overlap": kiện xếp sát nhau không có lỗi hay cảnh báo
    await expect(selected.getByRole('region', { name: 'Ràng buộc' })).toContainText('Không có lỗi hay cảnh báo')
    await closeInspector(page)

    // Duyệt
    await approve.click()
    const dialog = page.getByRole('dialog', { name: 'Duyệt phương án này?' })
    await expect(dialog).toContainText('Không còn cảnh báo ràng buộc.')
    const confirm = dialog.getByRole('button', { name: 'Duyệt', exact: true })
    if (tablet) heights.confirm = await heightOf(confirm)
    await confirm.click()
    await expect(page.getByText('Đã duyệt phương án.')).toBeVisible()

    // Mở màn kho phía client (LM-060): bước 1 là kiện `loadingOrder = 1` của revision vừa duyệt, đọc thẳng từ kho của trang.
    await page.waitForURL(/\/phuong-an\?revision=REV-/)
    const approved = await page.evaluate(async ({ db, tripId }) => {
      const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
      const revision = (await getMockDb().listRevisions(tripId)).findLast((item) => item.approvedAt !== undefined)
      return { id: revision?.id, first: revision?.result.placements.find((placement) => placement.loadingOrder === 1)?.packageInstanceId, total: revision?.result.placements.length }
    }, { db: MOCK_DB, tripId: 'TRIP-015' })
    expect(page.url()).toContain(`revision=${approved.id}`)
    await navigateInApp(page, '/kho?chuyen=TRIP-015')
    await expect(page.getByText(`Bước 1 / ${approved.total}`)).toBeVisible()
    await expect(page.getByRole('heading', { level: 1, name: approved.first, exact: true })).toBeVisible()
    await expect(page.getByText('MOCK RESULT', { exact: true })).toBeVisible()
    const confirmLoaded = page.getByRole('button', { name: 'Xác nhận đã xếp', exact: true })
    await expect(confirmLoaded).toBeVisible()
    if (tablet) {
      heights.confirmLoaded = await heightOf(confirmLoaded)
      expect(heights.confirmLoaded, 'warehouse primary button is a 56 px touch target').toBeGreaterThanOrEqual(56)
      await attachJson(testInfo, 'tablet-button-heights', heights)
    }
    expect(browserErrors).toStrictEqual([])
  })
}

test('invalid cargo blocks optimisation and the issue link opens the package to fix', async ({ page, login }) => {
  await login(`/chuyen/${SEED_TRIP}`)
  await expect(page.getByRole('row', { name: /PKG-006/ })).toBeVisible()

  // §15 "Validation chặn dữ liệu không hợp lệ": form kiện không lưu kiện không có hướng đặt nào
  await page.getByRole('button', { name: 'Thêm kiện', exact: true }).first().click()
  const draft = page.getByRole('complementary', { name: 'Kiện mới' })
  await draft.getByLabel('Tên kiện').fill('Kiện không hướng')
  for (const code of ['LWH', 'LHW', 'WLH', 'WHL', 'HLW', 'HWL']) await draft.getByRole('checkbox', { name: code, exact: true }).click()
  await draft.getByRole('button', { name: 'Lưu kiện', exact: true }).click()
  await expect(draft).toContainText('Chọn ít nhất một hướng đặt.')
  await expect(page.getByRole('row', { name: /PKG-007/ })).toHaveCount(0)
  await draft.getByRole('button', { name: 'Đóng panel kiện', exact: true }).click()

  // Kiện hợp lệ theo schema nhưng không lọt cửa 225 × 230 cm: lưu được, Thiết lập tối ưu chặn
  const panel = await addPackage(page, { name: 'Tủ lạnh công nghiệp', lengthCm: 300, widthCm: 300, heightCm: 300, weightKg: 50 })
  await expect(panel.getByRole('alert')).toHaveText('Kiện PKG-007 không lọt qua cửa 225 × 230 cm.')
  await expect(page.getByRole('row', { name: /PKG-007/ })).toBeVisible()

  await page.getByRole('link', { name: 'Chạy tối ưu', exact: true }).click()
  // §15 "Validation chặn dữ liệu không hợp lệ": nút Tối ưu tắt khi còn lỗi
  await expect(page.getByRole('button', { name: 'Tối ưu', exact: true })).toBeDisabled()
  const summary = page.getByRole('region', { name: 'Kiểm tra trước khi tối ưu' })
  await expect(summary.getByRole('alert')).toHaveText('Còn lỗi: sửa các mục đánh dấu đỏ để tối ưu.')
  await summary.getByRole('link', { name: 'Kiện PKG-007 không lọt qua cửa 225 × 230 cm.' }).click()

  // Liên kết mở đúng kiện cần sửa ở Chi tiết chuyến
  await expect(page).toHaveURL(new RegExp(`/chuyen/${SEED_TRIP}\\?kien=PKG-007$`))
  const linked = page.getByRole('complementary', { name: 'Kiện PKG-007' })
  await expect(linked.getByRole('textbox', { name: 'Tên kiện' })).toHaveValue('Tủ lạnh công nghiệp')
  // §15 "Thêm/sửa/xóa/nhân bản kiện": xoá kiện lỗi thì tối ưu chạy lại được
  await linked.getByRole('button', { name: 'Xoá kiện', exact: true }).click()
  await page.getByRole('dialog', { name: 'Xoá kiện PKG-007?' }).getByRole('button', { name: 'Xoá kiện', exact: true }).click()
  await expect(page.getByRole('row', { name: /PKG-007/ })).toHaveCount(0)
  await page.getByRole('link', { name: 'Chạy tối ưu', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Tối ưu', exact: true })).toBeEnabled()
})

test('cargo that does not fit lists unplaced packages with a reason in the Planner', async ({ page, login }) => {
  await login(`/chuyen/${SEED_TRIP}`)
  await expect(page.getByRole('row', { name: /PKG-006/ })).toBeVisible()
  // 30 × 1,2 m³ = 36 m³ thêm vào 132 kiện seed, vượt lòng thùng 720 × 235 × 240 cm (≈ 40,6 m³)
  await addPackage(page, { name: 'Pallet gạch', lengthCm: 120, widthCm: 100, heightCm: 100, weightKg: 20, quantity: 30 })
  await expect(page.getByRole('row', { name: /Pallet gạch PKG-007/ })).toBeVisible()
  await page.getByRole('link', { name: 'Chạy tối ưu', exact: true }).click()
  await optimizeAndOpenPlanner(page)

  const header = page.locator('header').first()
  await expect(header).toContainText('MOCK RESULT')
  const placed = (await header.innerText()).match(/Đã xếp\s*(\d+) \/ 162/)
  expect(placed, 'header shows placed out of 162 instances').not.toBeNull()
  const unplaced = 162 - Number(placed![1])
  expect(unplaced).toBeGreaterThan(0)

  // §15 "Hiển thị kiện chưa xếp và lý do"
  const inspector = await openInspector(page, 'packages')
  const tab = inspector.getByRole('tab', { name: `Kiện chưa xếp ${unplaced}`, exact: true })
  await expect(tab).toHaveAttribute('aria-selected', 'true')
  const list = inspector.getByRole('tabpanel', { name: `Kiện chưa xếp ${unplaced}` })
  await expect(list).toContainText('PKG-007-')
  await expect(list).toContainText('Không vừa chỗ trống còn lại.')
})

test('an unavailable optimisation service shows the error dialog and retry', async ({ page, login }) => {
  await login(`/chuyen/${SEED_TRIP}/toi-uu?mo-phong=loi`)
  await page.getByRole('button', { name: 'Tối ưu', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Không chạy được tối ưu' })
  await expect(dialog).toContainText('Dịch vụ tối ưu không phản hồi')
  await dialog.getByRole('button', { name: 'Thử lại', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Không chạy được tối ưu' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/chuyen/${SEED_TRIP}/toi-uu\\?mo-phong=loi$`))
})

test('editing a package after optimising makes the plan stale and blocks approval', async ({ page, login }) => {
  await login(`/chuyen/${SEED_TRIP}/toi-uu`)
  await optimizeAndOpenPlanner(page)
  const plannerUrl = page.url()
  // §15 "Mock service trả đúng OptimizationResult": revision vừa lưu qua đúng schema contract Spec
  const parsed = await page.evaluate(async ({ db, models, tripId }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const { optimizationResultSchema } = (await import(models)) as typeof import('@/domain/models')
    const jobId = new URL(location.href).searchParams.get('revision')
    const revision = (await getMockDb().listRevisions(tripId)).find((item) => item.jobId === jobId)
    const result = optimizationResultSchema.safeParse(revision?.result)
    return { success: result.success, isMockResult: revision?.result.isMockResult, status: revision?.result.status }
  }, { db: MOCK_DB, models: '/src/domain/models/index.ts', tripId: SEED_TRIP })
  expect(parsed).toStrictEqual({ success: true, isMockResult: true, status: 'COMPLETED' })
  await expect(page.getByRole('alert').filter({ hasText: 'Kết quả đã lỗi thời' })).toHaveCount(0)

  // §15 "Thêm/sửa/xóa/nhân bản kiện": sửa khối lượng kiện ở Chi tiết chuyến
  await page.getByRole('link', { name: 'Quay lại chuyến', exact: true }).click()
  await page.getByRole('row', { name: /PKG-001/ }).first().click()
  const panel = page.getByRole('complementary', { name: 'Kiện PKG-001' })
  const weight = panel.getByRole('spinbutton', { name: 'Khối lượng', exact: true })
  await weight.fill(String(Number(await weight.inputValue()) + 1))
  await panel.getByRole('button', { name: 'Lưu kiện', exact: true }).click()
  await expect(page.getByText('Đã lưu kiện PKG-001')).toBeVisible()

  // Quay lại đúng revision đã xem (history phía client, không tải lại)
  await page.goBack()
  await expect(page).toHaveURL(plannerUrl)
  await expect(page.getByRole('alert').filter({ hasText: 'Kết quả đã lỗi thời' })).toBeVisible()
  await page.getByRole('button', { name: 'Duyệt phương án', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Duyệt phương án này?' })
  await expect(dialog).toContainText('Kết quả lỗi thời — chạy tối ưu lại trước khi duyệt.')
  await expect(dialog.getByRole('button', { name: 'Duyệt', exact: true })).toBeDisabled()
})

test('switching to English mid-flow keeps form input and formats numbers the English way', async ({ page, login }) => {
  await login('/chuyen/moi')
  await page.getByRole('textbox', { name: 'Tên chuyến', exact: true }).fill('Tuyến Q.7 – Dĩ An')
  await page.getByRole('textbox', { name: 'Tên điểm giao 1', exact: true }).fill('Kho Long Bình')
  await page.getByRole('combobox', { name: 'Xe', exact: true }).click()
  await page.getByRole('option', { name: 'Hyundai HD210 · 60C-446.32', exact: true }).click()
  await expect(page.locator('form').getByText('9.500 kg', { exact: true })).toBeVisible()

  // V2.3: ngôn ngữ trên thanh điều hướng là một nút mở menu chọn
  await page.getByRole('button', { name: 'Ngôn ngữ giao diện', exact: true }).click()
  await page.getByRole('menuitemradio', { name: 'EN English', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Create trip', exact: true })).toBeVisible()
  // Dữ liệu đang nhập giữ nguyên, không tải lại trang
  await expect(page.getByRole('textbox', { name: 'Trip name', exact: true })).toHaveValue('Tuyến Q.7 – Dĩ An')
  await expect(page.getByRole('textbox', { name: 'Stop 1 name', exact: true })).toHaveValue('Kho Long Bình')
  await expect(page.getByRole('combobox', { name: 'Vehicle', exact: true })).toHaveText('Hyundai HD210 · 60C-446.32')
  // Số theo en-US
  await expect(page.locator('form').getByText('9,500 kg', { exact: true })).toBeVisible()
  await expect(page.getByText('720 × 235 × 240 cm', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Create trip', exact: true }).click()
  await expect(page.getByText('Created trip TRIP-015')).toBeVisible()
  await addPackageEn(page)
  await expect(page.getByText(/1\.2 m³/)).toBeVisible()
  // Dòng kiện, không lấy chữ đầu tiên khớp: sơ đồ tuyến gập sẵn cũng có "1 package · 1,234.5 kg"
  await expect(page.getByRole('row', { name: /Tủ đông .*1,234\.5 kg/ })).toBeVisible()
})

/** Thêm một kiện bằng nhãn tiếng Anh sau khi đã đổi ngôn ngữ. */
async function addPackageEn(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Add package', exact: true }).first().click()
  const panel = page.getByRole('complementary', { name: 'New package' })
  await panel.getByLabel('Package name').fill('Tủ đông')
  await panel.getByLabel('Length', { exact: true }).fill('120')
  await panel.getByLabel('Width', { exact: true }).fill('100')
  await panel.getByLabel('Height', { exact: true }).fill('100')
  await panel.getByLabel('Weight', { exact: true }).fill('1234.5')
  await panel.getByRole('button', { name: 'Save package', exact: true }).click()
}
