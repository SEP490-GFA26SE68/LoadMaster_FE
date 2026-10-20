import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, expect, test } from 'vitest'
import { IMPORT_COLUMNS } from '@/features/package-pool/package-pool-import'
import { I18nProvider } from '@/lib/i18n'
import { en } from '@/lib/i18n/en'
import { vi as viDict } from '@/lib/i18n/vi'
import { LandingCompare } from '../LandingCompare'
import { RevealProvider } from '../reveal'
import { COMPARE_ROWS } from './CompareTable'

/**
 * Mục "So với cách làm hiện tại" (`#so-sanh`): một `<table>` thật — tiêu đề cột `scope="col"`, tên việc là tiêu đề dòng `scope="row"` —
 * kể cả khi dưới 768 px bảng đổi thành thẻ (mỗi phần tử khai lại `role`); cột của file kiện mẫu là đúng cột của bộ nhập kho kiện.
 */
afterEach(cleanup)

function renderCompare() {
  return render(
    <I18nProvider>
      <RevealProvider>
        <LandingCompare />
      </RevealProvider>
    </I18nProvider>,
  )
}

test('the section is a labelled region at #so-sanh holding a real three-column comparison table', () => {
  renderCompare()
  const section = screen.getByRole('region', { name: 'So với cách làm hiện tại' })
  expect(section).toHaveAttribute('id', 'so-sanh')
  const table = within(section).getByRole('table', { name: 'Bảng tính và LoadMaster, theo từng việc của một chuyến hàng' })
  const columns = within(table).getAllByRole('columnheader')
  expect(columns.map((column) => column.textContent)).toStrictEqual(['Việc', 'Bảng tính và ước lượng bằng mắt', 'Với LoadMaster'])
  for (const column of columns) expect(column).toHaveAttribute('scope', 'col')
})

test('each job is a row header followed by the spreadsheet way and the LoadMaster way, in trip order', () => {
  renderCompare()
  const table = screen.getByRole('table')
  const rows = within(table).getAllByRole('row').slice(1)
  expect(rows).toHaveLength(COMPARE_ROWS.length)
  rows.forEach((row, index) => {
    const copy = viDict.landingCompare.rows[COMPARE_ROWS[index] ?? 'plan']
    const header = within(row).getByRole('rowheader')
    expect(header).toHaveAttribute('scope', 'row')
    expect(header).toHaveTextContent(copy.job)
    const cells = within(row).getAllByRole('cell')
    expect(cells).toHaveLength(2)
    expect(cells[0]).toHaveTextContent(copy.manual)
    expect(cells[1]).toHaveTextContent(copy.app)
  })
})

test('the package template lists exactly the importer columns, the optional one marked as such', () => {
  renderCompare()
  const list = screen.getByRole('list', { name: 'Cột của file kiện mẫu' })
  const items = within(list).getAllByRole('listitem').map((item) => item.textContent)
  expect(items).toStrictEqual(
    IMPORT_COLUMNS.map((column) =>
      column === 'package_type' ? `${viDict.sourcing.import.header[column]} (tuỳ chọn)` : viDict.sourcing.import.header[column],
    ),
  )
})

test('fit, preparation and an honest "not yet" line follow the table', () => {
  renderCompare()
  expect(screen.getByRole('heading', { level: 3, name: 'Phù hợp với' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { level: 3, name: 'Cần chuẩn bị' })).toBeInTheDocument()
  for (const name of ['Danh sách xe', 'Danh sách kiện', 'Điểm giao', 'Người dùng và thiết bị', 'Chưa có']) {
    expect(screen.getByRole('heading', { level: 4, name })).toBeInTheDocument()
  }
})

/** Mọi chuỗi lá của một nhánh từ điển. */
function strings(branch: unknown): string[] {
  if (typeof branch === 'string') return [branch]
  if (branch && typeof branch === 'object') return Object.values(branch).flatMap(strings)
  return []
}

test('no invented numbers: the only digits in either language are the names "3D", "A4" and ".xlsx"', () => {
  for (const copy of [viDict.landingCompare, en.landingCompare]) {
    for (const text of strings(copy)) expect(text.replace(/3D|A4/g, '')).not.toMatch(/\d/)
  }
})
