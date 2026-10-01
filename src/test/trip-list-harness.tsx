import { createColumnHelper } from '@tanstack/react-table'
import { useMemo } from 'react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router'
import { DataTable, type BaseTableFeatures, type ColumnMeta } from '@/components/DataTable'
import { FilterBar } from '@/components/FilterBar'
import { useListUrlState } from '@/components/useListUrlState'
import { I18nProvider } from '@/lib/i18n'
import { isWithinDateRange, matchesQuery } from '@/lib/list-filter'

/**
 * Màn danh sách chuyến thu nhỏ cho DOM test LM-085: `FilterBar` + `DataTable` + `useListUrlState` trong MemoryRouter,
 * đúng cách các màn chuyến, đội xe, người dùng, nhật ký sẽ ghép. Bấm một dòng mở trang chi tiết có nút Quay lại.
 */
export type TripFixture = { id: string; route: string; date: string; status: 'nhap' | 'da-lap-ke-hoach'; packages: number }

const ROUTES = [
  'Tuyến Thủ Đức – Dĩ An – Biên Hoà',
  'Tuyến Q.7 – An Phú – Phú Nhuận',
  'Tuyến Thủ Dầu Một – Quận 1 – Tân Bình',
  'Tuyến Tân An – Biên Hoà',
  'Tuyến Sóng Thần – Dĩ An – Thủ Dầu Một',
]

/**
 * 30 chuyến, mỗi ngày một chuyến từ 01/09/2026 (`TRIP-001` … `TRIP-030`). Tuyến lặp theo chu kỳ 5 nên chuyến 1, 4, 6, 9,
 * 11, 14, 16, 19, 21, 24, 26, 29 (12 chuyến) có "Biên Hoà". Chuyến 1, 4, 7, …, 28 (10 chuyến) là nháp. Số kiện 40 + số
 * thứ tự, riêng `TRIP-007` nhiều nhất (150) và `TRIP-013` ít nhất (12).
 */
export const TRIPS: readonly TripFixture[] = Array.from({ length: 30 }, (_, index) => {
  const number = index + 1
  return {
    id: `TRIP-${String(number).padStart(3, '0')}`,
    route: ROUTES[index % ROUTES.length]!,
    date: `2026-09-${String(number).padStart(2, '0')}`,
    status: index % 3 === 0 ? 'nhap' : 'da-lap-ke-hoach',
    packages: number === 7 ? 150 : number === 13 ? 12 : 40 + number,
  }
})

const helper = createColumnHelper<BaseTableFeatures, TripFixture>()

const COLUMNS = helper.columns([
  helper.accessor('date', { header: 'Ngày chạy', enableSorting: true, sortDescFirst: true, meta: { width: '120px' } satisfies ColumnMeta }),
  helper.accessor('id', { header: 'Mã chuyến', enableSorting: true }),
  helper.accessor('route', { header: 'Tuyến' }),
  helper.accessor('packages', { header: 'Số kiện', enableSorting: true, meta: { align: 'right' } satisfies ColumnMeta }),
])

const STATUS_OPTIONS = [
  { value: 'nhap', label: 'Nháp' },
  { value: 'da-lap-ke-hoach', label: 'Đã lập kế hoạch' },
]

function TripList() {
  const navigate = useNavigate()
  const list = useListUrlState({ filters: ['trang-thai', 'tu', 'den'], defaultSort: { id: 'date', desc: true } })
  const { query, filters: { 'trang-thai': status, tu: from, den: to } } = list
  const rows = useMemo(() => TRIPS.filter((trip) =>
    matchesQuery([trip.id, trip.route], query)
    && (status === '' || trip.status === status)
    && isWithinDateRange(trip.date, from, to)), [query, status, from, to])

  return (
    <>
      <FilterBar
        query={list.query}
        onQueryChange={list.setQuery}
        searchLabel="Tìm theo mã, tuyến"
        fields={[
          { kind: 'select', name: 'trang-thai', label: 'Trạng thái', options: STATUS_OPTIONS },
          { kind: 'dateRange', label: 'Ngày chạy', from: 'tu', to: 'den' },
        ]}
        values={list.filters}
        onValueChange={list.setFilter}
        onClear={list.clearAll}
      />
      <DataTable
        data={rows}
        columns={COLUMNS}
        sorting={list.sorting}
        onSortingChange={list.setSorting}
        pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
        isFiltering={list.isFiltering}
        onClearFilters={list.clearAll}
        onRowClick={(trip) => void navigate(`/chuyen/${trip.id}`)}
      />
    </>
  )
}

function TripDetail() {
  const navigate = useNavigate()
  return <button type="button" onClick={() => void navigate(-1)}>Quay lại danh sách</button>
}

/** Địa chỉ hiện tại (đường dẫn + query) để test so URL. */
function CurrentUrl() {
  const location = useLocation()
  return <p data-testid="url">{`${location.pathname}${location.search}`}</p>
}

export function renderTripList(url = '/chuyen') {
  return (
    <I18nProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/chuyen" element={<TripList />} />
          <Route path="/chuyen/:tripId" element={<TripDetail />} />
        </Routes>
        <CurrentUrl />
      </MemoryRouter>
    </I18nProvider>
  )
}
