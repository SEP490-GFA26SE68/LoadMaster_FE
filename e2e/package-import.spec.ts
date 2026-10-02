import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'
import { expect, test } from './fixtures'
import { MOCK_DB, navigateInApp } from './spec-flow-helpers'

/**
 * Nhập kiện từ file (LM-093, D-49): tải file mẫu CSV của chuyến, thêm một dòng lỗi, nhập lại bằng `setInputFiles` — xem trước nói dòng
 * lỗi, chỉ dòng hợp lệ được ghi, trong một lần ghi (một lần tăng `inputVersion`, một sự kiện nhật ký).
 *
 * FE-3b-07 (D-68): mỗi instance của dòng vừa nhập là một kiện kho kiện "Đã gán chuyến", nguồn "Thêm trong chuyến", có mã QR — nhãn in
 * được ngay từ chuyến và tra cứu ra đúng kiện; xoá dòng khỏi chuyến thì kiện về "Đã nhập", rời chuyến.
 */
const TRIP = 'TRIP-014'

function tripState(page: Page) {
  return page.evaluate(async ({ db, tripId }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const store = getMockDb()
    const [trip, events] = await Promise.all([store.getTrip(tripId), store.listEvents({ targetId: tripId })])
    return { ids: trip.packages.map((pkg) => pkg.id), inputVersion: trip.inputVersion, events: events.map((event) => ({ action: event.action, params: event.params })) }
  }, { db: MOCK_DB, tripId: TRIP })
}

/** Kiện kho kiện theo mã của bên gửi (mã instance trong chuyến), đọc thẳng kho của trang. */
function poolPackages(page: Page, codes: readonly string[]) {
  return page.evaluate(async ({ db, tripId, wanted }) => {
    const { getMockDb } = (await import(db)) as typeof import('@/lib/mock-db')
    const all = await getMockDb().listPackages()
    const labels = await getMockDb().listTripLabels(tripId)
    return wanted.map((code) => {
      const pkg = all.findLast((item) => item.packageCode === code && item.source === 'TRIP' && (item.tripId === tripId || item.history.some((entry) => entry.kind === 'status' && entry.tripId === tripId)))
      return pkg ? { id: pkg.id, code, status: pkg.status, tripId: pkg.tripId ?? null, stopId: pkg.stopId ?? null, handlingClass: pkg.handlingClass, qrToken: pkg.qrToken, labelled: labels.some((label) => label.qrToken === pkg.qrToken) } : null
    })
  }, { db: MOCK_DB, tripId: TRIP, wanted: [...codes] })
}

test('the CSV template with one bad row added imports only its valid rows, in one write', async ({ page, login, browserErrors }) => {
  await login(`/chuyen/${TRIP}`)
  await page.getByRole('button', { name: 'Nhập từ file', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Nhập kiện từ file' })

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    dialog.getByRole('button', { name: 'Tải mẫu .csv', exact: true }).click(),
  ])
  expect(download.suggestedFilename()).toBe(`mau-nhap-kien-${TRIP}.csv`)
  const template = await readFile(await download.path(), 'utf8')
  expect(template.startsWith('﻿Mã kiện,Tên kiện,Dài (cm)')).toBe(true)

  // File mẫu có 20 cột, cột cuối là loại hàng (FE-3b-07). Dòng thêm chỉ có 19 cột như mẫu cũ — vẫn đọc được; "Dài (cm)" không phải số
  expect(template.split('\r\n')[0]?.endsWith(',Ghi chú,Loại hàng')).toBe(true)
  const bad = 'PKG-099,Kiện lỗi,abc,40,30,12,1,1,LWH,có,NONE,có,0,,0.8,0,không,,'
  const before = await tripState(page)
  await dialog.getByLabel('File kiện (.csv, .xlsx)').setInputFiles({
    name: 'kien-chuyen.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(`${template}${bad}\r\n`, 'utf8'),
  })

  await expect(dialog.getByRole('status').filter({ hasText: 'Đọc được 3 dòng: 2 hợp lệ, 1 lỗi.' })).toBeVisible()
  await expect(dialog.getByText('Dài (cm): "abc" không phải là số.', { exact: true })).toBeVisible()
  await expect(dialog.getByText('Bỏ qua 1 dòng lỗi.', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Nhập 2 dòng hợp lệ', exact: true }).click()

  await expect(dialog).toHaveCount(0)
  await expect(page.getByText('Đã nhập 2 dòng kiện', { exact: true })).toBeVisible()
  await expect(page.getByRole('row', { name: /PKG-004/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /PKG-005/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /PKG-099/ })).toHaveCount(0)

  const after = await tripState(page)
  expect(after.ids).toStrictEqual([...before.ids, 'PKG-004', 'PKG-005'])
  expect(after.inputVersion).toBe(before.inputVersion + 1)
  expect(after.events).toHaveLength(before.events.length + 1)
  expect(after.events[0]).toStrictEqual({ action: 'trip.updated', params: { fields: 'packages' } })

  // FE-3b-07: 10 thùng nước suối (PKG-004, hàng thường) và 4 bao gạo (PKG-005, mẫu ghi FRAGILE) — mỗi kiện một bản ghi kho kiện đã gán chuyến
  const created = await poolPackages(page, ['PKG-004-01', 'PKG-004-10', 'PKG-005-01', 'PKG-005-04'])
  expect(created.map((pkg) => [pkg?.status, pkg?.tripId, pkg?.handlingClass, pkg?.labelled])).toStrictEqual([
    ['ASSIGNED', TRIP, 'STANDARD', true], ['ASSIGNED', TRIP, 'STANDARD', true], ['ASSIGNED', TRIP, 'FRAGILE', true], ['ASSIGNED', TRIP, 'FRAGILE', true],
  ])
  const rice = created[2]
  expect(rice?.qrToken).toMatch(/^LM-[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/)

  // Nhãn in được ngay từ chuyến: 140 kiện có sẵn + 14 kiện vừa nhập; nhãn bao gạo mang dòng "Hàng dễ vỡ" và đúng mã QR của kiện
  await page.getByRole('region', { name: 'Kiện hàng' }).getByRole('link', { name: 'In nhãn QR', exact: true }).click()
  await page.waitForURL((url) => url.pathname === '/kien-hang/nhan' && url.searchParams.get('chuyen') === TRIP)
  await expect(page.getByText('154 nhãn có thể in', { exact: true })).toBeVisible()
  const label = page.getByRole('region', { name: 'Trang nhãn QR' }).getByRole('article', { name: rice?.id ?? '', exact: true })
  await expect(label.getByRole('img', { name: `Mã QR ${rice?.qrToken}`, exact: true })).toBeVisible()
  await expect(label).toContainText('Mã bên gửiPKG-005-01')
  await expect(label.getByText('Hàng dễ vỡ', { exact: true })).toBeVisible()

  // Tra cứu mã trên nhãn ra đúng kiện, kèm chuyến và điểm giao
  await navigateInApp(page, `/tra-cuu-kien?ma=${rice?.qrToken}`)
  const card = page.getByRole('region', { name: 'Kiện PKG-005-01', exact: true })
  await expect(card.getByText('Đã gán chuyến', { exact: true })).toBeVisible()
  await expect(card.getByRole('link', { name: TRIP, exact: true })).toHaveAttribute('href', `/chuyen/${TRIP}`)

  // Xoá dòng bao gạo khỏi chuyến: bốn kiện về "Đã nhập", rời chuyến và điểm giao; nhãn của chuyến không còn chúng
  await card.getByRole('link', { name: TRIP, exact: true }).click()
  await page.waitForURL(new RegExp(`/chuyen/${TRIP}$`))
  await page.getByRole('row', { name: /PKG-005/ }).click()
  const panel = page.getByRole('complementary', { name: 'Kiện PKG-005' })
  await panel.getByRole('button', { name: 'Xoá kiện', exact: true }).click()
  await page.getByRole('dialog', { name: 'Xoá kiện PKG-005?' }).getByRole('button', { name: 'Xoá kiện', exact: true }).click()
  await expect(page.getByRole('row', { name: /PKG-005/ })).toHaveCount(0)
  const released = await poolPackages(page, ['PKG-005-01', 'PKG-005-04', 'PKG-004-01'])
  expect(released.map((pkg) => [pkg?.status, pkg?.tripId, pkg?.stopId, pkg?.labelled])).toStrictEqual([
    ['IMPORTED', null, null, false], ['IMPORTED', null, null, false], ['ASSIGNED', TRIP, 'STOP-01', true],
  ])
  expect(released[0]?.qrToken).toBe(rice?.qrToken)
  await navigateInApp(page, `/tra-cuu-kien?ma=${rice?.qrToken}`)
  await expect(card.getByText('Đã nhập', { exact: true })).toBeVisible()
  await expect(card.getByText('Chưa vào chuyến nào', { exact: true })).toBeVisible()
  expect(browserErrors).toStrictEqual([])
})
