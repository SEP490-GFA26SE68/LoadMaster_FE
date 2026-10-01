import { render, screen, within } from '@testing-library/react'
import { expect, test } from 'vitest'
import { I18nProvider } from '@/lib/i18n'
import { PermissionMatrix } from './PermissionMatrix'

/**
 * Tab "Ma trận quyền" (LM-092, FE-0-01): bảng chỉ đọc dựng từ `ROLE_PERMISSIONS`. Kỳ vọng chép tay từ ma trận của PRD v2 mục 5.2 và hai
 * chỗ còn tạm (đơn hàng, hai vai trò Review 1), không đọc lại bảng quyền.
 */
function renderMatrix() {
  render(<I18nProvider><PermissionMatrix /></I18nProvider>)
  return screen.getByRole('table')
}

/** Các ô vai trò ("Có" / "Không") của dòng có nhãn bắt đầu bằng `label`, theo thứ tự cột. */
function cellsOf(matrix: HTMLElement, label: string) {
  const row = within(matrix).getAllByRole('row').find((item) => item.textContent?.startsWith(label))
  if (!row) throw new Error(`Không có dòng quyền ${label}`)
  return within(row).getAllByRole('cell').slice(1).map((cell) => cell.textContent)
}

const NO = 'Không'
const YES = 'Có'

test('mười cột vai trò theo thứ tự nền tảng → công ty → tạm, 38 dòng quyền kèm mã', () => {
  const matrix = renderMatrix()
  expect(within(matrix).getAllByRole('columnheader').map((cell) => cell.textContent)).toStrictEqual([
    'Quyền', 'Quản trị hệ thống', 'Quản lý nền tảng', 'Hỗ trợ khách hàng', 'Quản trị công ty', 'Quản lý công ty', 'Điều phối viên',
    'Nhân viên kho', 'Tài xế', 'Nhà sản xuất', 'Công ty logistics',
  ])
  expect(within(matrix).getAllByRole('row')).toHaveLength(39)
  // Dòng đầu và dòng cuối của ma trận; mã quyền nằm ngay dưới tên
  const labels = within(matrix).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0]?.textContent)
  expect([labels[0], labels.at(-1)]).toStrictEqual(['Tạo và quản lý công ty khách hàngcompanies.manage', 'Quét QR nhận hàngreceiving.operate'])
  // Quyền của màn chưa làm vẫn có dòng và nhãn
  expect(labels).toContain('Xem giám sát chuyến đang chạymonitoring.view')
  expect(labels).toContain('Duyệt yêu cầu nhận hàng dọc đườngpickups.approve')
  expect(screen.getByText(/^Chỉ đọc, dựng từ cấu hình quyền của hệ thống\./)).toHaveTextContent('Một số quyền thuộc những màn bản này chưa có.')
})

test('quản trị hệ thống và quản trị công ty quản lý người dùng; ba vai trò nền tảng không có quyền vận hành', () => {
  const matrix = renderMatrix()
  // Cột: quản trị hệ thống, quản lý nền tảng, hỗ trợ, quản trị công ty, quản lý, điều phối, kho, tài xế, nhà sản xuất, logistics
  expect(cellsOf(matrix, 'Tạo và quản lý công ty khách hàng')).toStrictEqual([YES, NO, NO, NO, NO, NO, NO, NO, NO, NO])
  expect(cellsOf(matrix, 'Quản lý người dùng')).toStrictEqual([YES, NO, NO, YES, NO, NO, NO, NO, NO, NO])
  expect(cellsOf(matrix, 'Xem nhật ký hệ thống')).toStrictEqual([YES, NO, NO, YES, NO, NO, NO, NO, NO, NO])
  expect(cellsOf(matrix, 'Tạo, sửa gói cước và chính sách credit')).toStrictEqual([NO, YES, NO, NO, NO, NO, NO, NO, NO, NO])
  expect(cellsOf(matrix, 'Xử lý yêu cầu hỗ trợ')).toStrictEqual([NO, NO, YES, NO, NO, NO, NO, NO, NO, NO])
  expect(cellsOf(matrix, 'Gửi yêu cầu hỗ trợ')).toStrictEqual([NO, NO, NO, YES, YES, YES, YES, YES, NO, NO])
  expect(cellsOf(matrix, 'Xem chuyến hàng')).toStrictEqual([NO, NO, NO, NO, YES, YES, NO, NO, NO, NO])
  expect(cellsOf(matrix, 'Xếp hàng tại kho')).toStrictEqual([NO, NO, NO, NO, NO, NO, YES, NO, NO, NO])
  expect(cellsOf(matrix, 'Giao hàng')).toStrictEqual([NO, NO, NO, NO, NO, NO, NO, YES, NO, NO])
})

test('chỉ quản lý công ty xuất báo cáo; điều phối chạy tối ưu, chỉnh sửa và duyệt phương án (FE-0-07)', () => {
  const matrix = renderMatrix()
  expect(cellsOf(matrix, 'Xuất báo cáo .xlsx')).toStrictEqual([NO, NO, NO, NO, YES, NO, NO, NO, NO, NO])
  expect(cellsOf(matrix, 'Chỉnh sửa và duyệt phương án')).toStrictEqual([NO, NO, NO, NO, NO, YES, NO, NO, NO, NO])
  expect(cellsOf(matrix, 'Xem phương án 3D và so sánh')).toStrictEqual([NO, NO, NO, NO, YES, YES, NO, NO, NO, NO])
  expect(cellsOf(matrix, 'Chạy tối ưu')).toStrictEqual([NO, NO, NO, NO, NO, YES, NO, NO, NO, NO])
  expect(cellsOf(matrix, 'Xem đơn hàng')).toStrictEqual([NO, NO, NO, NO, YES, YES, NO, NO, NO, NO])
  expect(cellsOf(matrix, 'Loại kiện, đăng ký kiện và in nhãn QR')).toStrictEqual([NO, NO, NO, NO, NO, NO, NO, NO, YES, NO])
  expect(cellsOf(matrix, 'Quét QR nhận hàng')).toStrictEqual([NO, NO, NO, NO, NO, NO, NO, NO, NO, YES])
})
