import readXlsxFile from 'read-excel-file/node'
import { expect, test } from './fixtures'

/**
 * Bảng điều khiển của quản lý (LM-090, D-48): đổi kỳ trên URL, KPI tính lại, xuất báo cáo .xlsx ba sheet có kỳ trong tên file.
 * Seed neo theo hôm nay (giờ Việt Nam): 30 ngày có 12 chuyến (7 hoàn thành), 7 ngày có 5 chuyến (1 hoàn thành).
 */

/** Hôm nay theo giờ Việt Nam (UTC+7), `YYYY-MM-DD` — cùng mốc với seed và kỳ của màn. */
function vnToday(): string {
  return new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

test('the manager switches to 7 days and exports a three-sheet report named after the period', async ({ page, login, browserErrors }) => {
  await login('/', 'manager')
  const trips = page.getByRole('group', { name: 'Chuyến hoàn thành', exact: true })
  await expect(trips).toContainText('7/ 12 chuyến')
  await expect(page.getByRole('figure', { name: 'Lấp đầy theo ngày', exact: true })).toBeVisible()
  // Hai biểu đồ cột ngang vẽ bằng recharts trong lưới V2: mỗi trạng thái / mỗi xe đã giao một cột. FE-0-05: kỳ 30 ngày có
  // đã lập kế hoạch, đang xếp hàng, đang vận chuyển, đã giao, đã huỷ
  await expect(page.getByRole('figure', { name: 'Chuyến theo trạng thái', exact: true }).locator('.recharts-bar-rectangle'))
    .toHaveCount(5)
  await expect(page.getByRole('figure', { name: 'Khối lượng đã giao theo xe', exact: true }).locator('.recharts-bar-rectangle').first())
    .toBeVisible()
  // Thẻ đội xe (V2): ba trạng thái với nhãn của màn Đội xe, không theo kỳ; quản lý được xem đội xe nên có lối sang
  const fleet = page.getByRole('region', { name: 'Trạng thái đội xe', exact: true })
  await expect(fleet.getByRole('listitem')).toHaveText([/^\d+Sẵn sàng$/, /^\d+Đang phục vụ chuyến$/, /^\d+Bảo dưỡng$/])
  await expect(fleet.getByRole('link', { name: 'Xem đội xe', exact: true })).toHaveAttribute('href', '/doi-xe')

  await page.getByRole('button', { name: '7 ngày', exact: true }).click()
  await expect(trips).toContainText('1/ 5 chuyến')
  await expect(page).toHaveURL(/\/\?ky=7-ngay$/)

  const today = vnToday()
  const fileName = `bao-cao-van-hanh_${addDays(today, -6)}_${today}.xlsx`
  // Quản lý không lập kế hoạch: xuất báo cáo là hành động chính duy nhất
  const exportButton = page.getByRole('button', { name: 'Xuất báo cáo', exact: true })
  await expect(page.getByRole('link', { name: 'Tạo kế hoạch xếp', exact: true })).toHaveCount(0)
  const [download] = await Promise.all([page.waitForEvent('download'), exportButton.click()])
  expect(download.suggestedFilename()).toBe(fileName)
  await expect(page.getByText(`Đã tải xuống ${fileName}`, { exact: true })).toBeVisible()

  const sheets = await readXlsxFile(await download.path())
  expect(sheets.map(({ sheet }) => sheet)).toStrictEqual(['Tổng quan', 'Chuyến', 'Theo xe'])
  // Tiêu đề cột + 5 chuyến của kỳ
  expect(sheets[1]?.data).toHaveLength(6)
  expect(sheets[1]?.data[0]?.[0]).toBe('Mã chuyến')
  const overview = sheets[0]?.data ?? []
  expect(overview.find((row) => row[0] === 'Chuyến trong kỳ')?.[1]).toBe(5)
  expect(overview.find((row) => row[0] === 'Chuyến hoàn thành')?.[1]).toBe(1)
  expect(browserErrors).toStrictEqual([])
})
