import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { navigateInApp, waitForOtherRevision } from './spec-flow-helpers'

/**
 * Luồng Thiết lập tối ưu → chạy job (LM-047, LM-048) với ba phương án ứng viên mỗi lần chạy (FE-5b-05, D-77): đang chạy (tiến trình
 * của cả ba), thành công (ba revision của một lần chạy, mở màn So sánh của lần chạy đó rồi duyệt một phương án trong Planner), huỷ
 * (không phương án nào được lưu), lỗi service, kết quả một phần, chuyến chưa tối ưu tuyến.
 * Dữ liệu đọc và sửa trong trình duyệt qua đúng module kho app đang dùng (`/src/lib/mock-db/index.ts`), không giả lập mạng.
 */
test.use({ collectConsoleErrors: true })

const TRIP_ID = 'TRIP-2026-0914'
const SETUP = `/chuyen/${TRIP_ID}/toi-uu`
const MOCK_DB = '/src/lib/mock-db/index.ts'
const RUNNING = 'Đang tối ưu phương án xếp hàng'

const optimize = (page: Page) => page.getByRole('button', { name: 'Tối ưu', exact: true })

/** Revision và lần chạy của chuyến trong kho của trang. */
function stored(page: Page, tripId = TRIP_ID) {
  return page.evaluate(async ({ url, id }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    const [revisions, runs] = await Promise.all([db.listRevisions(id), db.listOptimizationRuns(id)])
    return {
      revisions: revisions.map((revision) => ({
        id: revision.id, runId: revision.runId, objective: revision.run?.objective, algorithm: revision.run?.algorithm, jobId: revision.jobId,
        status: revision.result.status, mock: revision.result.isMockResult, approved: revision.approvedAt !== undefined,
      })),
      runs: runs.map((run) => ({ id: run.id, status: run.status, algorithm: run.algorithm, failureCode: run.failureCode, plans: (run.plans ?? []).map((plan) => plan.revisionId) })),
    }
  }, { url: MOCK_DB, id: tripId })
}

test('one run reports the progress of three plans, saves them as three revisions of one run, opens their comparison, and one is approved in the Planner', async ({ page, login, browserErrors }) => {
  await login(SETUP)
  await expect(optimize(page)).toBeEnabled()
  // Không còn ô chọn mục tiêu hay thuật toán: màn liệt kê ba phương án và nói tên thuật toán sẽ chạy
  await expect(page.getByRole('list', { name: 'Ba phương án mỗi lần chạy', exact: true }).getByRole('listitem')).toHaveText([
    /Tối đa thể tích/, /Cân bằng tải trục/, /Ít dỡ-xếp lại/,
  ])
  await page.locator('summary').filter({ hasText: 'Thiết lập nâng cao' }).click()
  await expect(page.getByRole('radio')).toHaveCount(0)
  await expect(page.locator('[data-run-algorithm]')).toHaveText('EP + DBLF (mock)')
  const before = await stored(page)

  await optimize(page).click()
  const dialog = page.getByRole('dialog', { name: RUNNING })
  await expect(dialog).toBeVisible()
  // Tiến trình báo cả ba phương án, theo thứ tự A · B · C
  await expect(dialog.locator('[data-plan-progress]')).toHaveText([/^A.*Tối đa thể tích/, /^B.*Cân bằng tải trục/, /^C.*Ít dỡ-xếp lại/])
  await expect(dialog).toContainText(/Đã xong \d \/ 3 phương án/)

  // Chạy xong: màn So sánh của đúng lần chạy mới (seed của Long Bình có RUN-001 … RUN-015)
  await page.waitForURL(`/chuyen/${TRIP_ID}/so-sanh?lan-chay=RUN-016`)
  await expect(page.locator('[data-candidate]')).toHaveCount(3)
  const after = await stored(page)
  expect(after.revisions.length).toBe(before.revisions.length + 3)
  const added = after.revisions.slice(before.revisions.length)
  expect(added.map(({ id, runId, objective, algorithm, status, mock, approved }) => ({ id, runId, objective, algorithm, status, mock, approved }))).toStrictEqual([
    { id: 'REV-028', runId: 'RUN-016', objective: 'MAX_VOLUME', algorithm: 'EP_DBLF', status: 'COMPLETED', mock: true, approved: false },
    { id: 'REV-029', runId: 'RUN-016', objective: 'AXLE_BALANCE', algorithm: 'EP_DBLF', status: 'COMPLETED', mock: true, approved: false },
    { id: 'REV-030', runId: 'RUN-016', objective: 'MIN_REHANDLING', algorithm: 'EP_DBLF', status: 'COMPLETED', mock: true, approved: false },
  ])
  expect(added.map(({ jobId }) => jobId.replace(/^MOCK-\d+-[0-9a-f]{8}/, 'JOB'))).toStrictEqual(['JOB-A', 'JOB-B', 'JOB-C'])
  expect(after.runs.slice(before.runs.length)).toStrictEqual([
    { id: 'RUN-016', status: 'COMPLETED', algorithm: 'EP_DBLF', failureCode: undefined, plans: ['REV-028', 'REV-029', 'REV-030'] },
  ])
  // Ba thẻ mang đúng mã của ba revision vừa lưu
  for (const [label, id] of [['A', 'REV-028'], ['B', 'REV-029'], ['C', 'REV-030']] as const) {
    await expect(page.locator(`[data-candidate="${label}"]`)).toContainText(id)
    await expect(page.locator(`[data-candidate="${label}"]`).getByText('MOCK RESULT', { exact: true })).toBeVisible()
  }

  // Mở phương án B trong Planner rồi duyệt: Duyệt tạo revision đã duyệt mới
  await page.getByRole('link', { name: 'Mở phương án B trong Planner', exact: true }).click()
  await page.waitForURL(`/chuyen/${TRIP_ID}/phuong-an?revision=REV-029`)
  await page.locator('canvas').waitFor()
  await page.getByRole('button', { name: 'Duyệt phương án', exact: true }).click()
  await page.getByRole('dialog', { name: 'Duyệt phương án này?' }).getByRole('button', { name: 'Duyệt', exact: true }).click()
  await waitForOtherRevision(page, 'REV-029')
  expect(new URL(page.url()).searchParams.get('revision')).toBe('REV-031')

  // Quay lại màn So sánh của lần chạy: thẻ B mang nhãn đã duyệt và lối tới bản đã duyệt
  await navigateInApp(page, `/chuyen/${TRIP_ID}/so-sanh?lan-chay=RUN-016`)
  const approved = page.locator('[data-candidate="B"]')
  await expect(approved.getByText('Đã duyệt', { exact: true })).toBeVisible()
  await expect(approved.getByRole('link', { name: 'Mở bản đã duyệt REV-031', exact: true })).toBeVisible()
  await expect(page.locator('[data-candidate="A"]').getByText('Đã duyệt', { exact: true })).toHaveCount(0)
  expect(browserErrors).toStrictEqual([])
})

test('cancelling cancels all three plans: back on the setup screen, no revision and no run are created', async ({ page, login }) => {
  await login(SETUP)
  const before = await stored(page)
  await optimize(page).click()
  await page.getByRole('dialog', { name: RUNNING }).getByRole('button', { name: 'Huỷ' }).click()
  await expect(page.getByText('Đã huỷ tối ưu; không tạo phương án mới.')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${SETUP}$`))
  expect(await stored(page)).toStrictEqual(before)
})

test('an unavailable service shows the error dialog with a working retry, and the failed run is in the history without a plan', async ({ page, login }) => {
  await login(`${SETUP}?mo-phong=loi`)
  const before = await stored(page)
  await optimize(page).click()
  const dialog = page.getByRole('dialog', { name: 'Không chạy được tối ưu' })
  await expect(dialog).toContainText('Dịch vụ tối ưu không phản hồi')
  const after = await stored(page)
  expect(after.revisions).toStrictEqual(before.revisions)
  expect(after.runs.slice(before.runs.length)).toStrictEqual([{ id: 'RUN-016', status: 'FAILED', algorithm: 'EP_DBLF', failureCode: 'SERVICE_UNAVAILABLE', plans: [] }])
  await dialog.getByRole('button', { name: 'Thử lại' }).click()
  await expect(page.getByRole('dialog', { name: 'Không chạy được tối ưu' })).toBeVisible()
})

test('cargo over the payload gives a partial result notice, and every candidate card says how many packages it left out', async ({ page, login }) => {
  // Sửa kho trước khi màn thiết lập đọc (Query giữ dữ liệu 30 s); app ghi thật thì mutation tự làm mới.
  await login('/doi-xe')
  await page.evaluate(async ({ url, tripId }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    const trip = await db.getTrip(tripId)
    // 150 × 48 kg = 7.200 kg thêm vào 5.844 kg của seed: vượt tải 9.500 kg của xe, kiện không bắt buộc nên vẫn chạy được
    const bulky = { ...trip.packages[0]!, id: 'PKG-950', name: 'Kiện dư', quantity: 150, mustLoad: false, priority: 0 }
    await db.updateTrip(tripId, { packages: [...trip.packages, bulky] })
  }, { url: MOCK_DB, tripId: TRIP_ID })
  // Kho nằm trong bộ nhớ trang: chuyển route phía client, không tải lại.
  await navigateInApp(page, SETUP)
  // Chờ màn đọc lại kho: 132 kiện seed + 150 kiện thêm
  await expect(page.getByRole('definition').filter({ hasText: /^282 \/ 7 dòng$/ })).toBeVisible()
  await optimize(page).click()
  await expect(page.getByText(/Kết quả một phần: \d+ kiện chưa xếp\./)).toBeVisible({ timeout: 30_000 })
  await page.waitForURL(/\/so-sanh\?lan-chay=RUN-016$/)
  const unplaced = await page.locator('[data-candidate] [data-metric="unplaced"] dd').allInnerTexts()
  expect(unplaced).toHaveLength(3)
  for (const text of unplaced) expect(Number(/^(\d+) kiện/.exec(text)?.[1]), text).toBeGreaterThan(0)
})

test('a draft trip cannot be optimized: the route check sends the dispatcher to the trip, and the store rejects a run as well', async ({ page, login }) => {
  // TRIP-014 là chuyến nháp của seed: chưa tối ưu tuyến
  await login('/chuyen/TRIP-014/toi-uu')
  const summary = page.getByRole('region', { name: 'Kiểm tra trước khi tối ưu', exact: true })
  await expect(summary.getByText('Chuyến còn Nháp. Tối ưu tuyến ở Chi tiết chuyến để chốt thứ tự điểm giao trước khi xếp hàng.', { exact: true })).toBeVisible()
  await expect(optimize(page)).toBeDisabled()
  await expect(optimize(page)).toHaveAccessibleDescription('Chưa chạy được: 1 lỗi cần sửa ở Tuyến.')
  const rejected = await page.evaluate(async ({ url }) => {
    const { getMockDb } = (await import(url)) as typeof import('@/lib/mock-db')
    const db = getMockDb()
    const source = (await db.listRevisions('TRIP-2026-0914'))[0]!
    return db.saveOptimizationRun({ tripId: 'TRIP-014', request: source.request, jobId: 'JOB', plans: [{ objective: 'MAX_VOLUME', result: source.result }] })
      .then(() => 'saved', (error: { code?: string }) => error.code)
  }, { url: MOCK_DB })
  expect(rejected).toBe('ROUTE_NOT_PLANNED')
  await summary.getByRole('link', { name: 'Tới Chi tiết chuyến', exact: true }).click()
  await page.waitForURL(/\/chuyen\/TRIP-014$/)
})
