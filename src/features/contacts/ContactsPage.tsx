import { RotateCcw } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useSearchParams } from 'react-router'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { FilterBar, type FilterField } from '@/components/FilterBar'
import { PageHero } from '@/components/PageHero'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { useListUrlState } from '@/components/useListUrlState'
import { CONTACT_TYPE_SLUGS } from '@/lib/contact-slugs'
import { dataErrorMessage, useT } from '@/lib/i18n'
import { CONTACT_REQUEST_TYPES, CONTACT_STATUSES } from '@/lib/mock-db'
import { cn } from '@/lib/utils'
import {
  CONTACT_FILTERS,
  CONTACT_STATUS_SLUGS,
  contactRows,
  countNew,
  filterContactRows,
  SELECTED_PARAM,
  STATUS_FILTER,
  TYPE_FILTER,
  type ContactFilter,
  type ContactRow,
} from './contact-list'
import { ContactPanel } from './ContactPanel'
import { createContactColumns } from './contacts-columns'
import { useContactHandlersQuery, useContactPlanNamesQuery, useGuestContactsQuery } from './useContactsQuery'

const EMPTY_NAMES: ReadonlyMap<string, string> = new Map()

/**
 * Liên hệ của khách `/lien-he-khach` (`contacts.handle`: Hỗ trợ khách hàng, Quản lý nền tảng, Quản trị hệ thống) — yêu cầu khách chưa có
 * tài khoản gửi từ form ở trang giới thiệu. Bảng mới nhất trước; tìm, lọc trạng thái và loại trên URL; bấm một dòng (hoặc tên khách) mở
 * khung bên phải (`?lien-he=`) để đổi trạng thái, nhận việc và ghi chú nội bộ. Nút chính duy nhất là "Lưu thay đổi" của khung đó.
 */
export function ContactsPage() {
  const t = useT()
  const query = useGuestContactsQuery()
  const planNames = useContactPlanNamesQuery()
  const handlers = useContactHandlersQuery()
  const list = useListUrlState<ContactFilter>({ filters: CONTACT_FILTERS })
  const [params, setParams] = useSearchParams()

  const allRows = useMemo(() => contactRows(query.data ?? [], planNames.data ?? EMPTY_NAMES), [query.data, planNames.data])
  const rows = useMemo(() => filterContactRows(allRows, list.query, list.filters), [allRows, list.query, list.filters])
  const selectedId = params.get(SELECTED_PARAM)
  const selected = allRows.find((row) => row.contact.id === selectedId)
  const compact = selected !== undefined
  const columns = useMemo(() => createContactColumns(t, compact), [t, compact])

  // Đóng khung bằng nút Đóng: focus về liên kết tên của đúng dòng đó (bảng vừa dựng lại cột nên liên kết là phần tử mới)
  const tableRef = useRef<HTMLElement>(null)
  const returnFocusTo = useRef<string | null>(null)
  useEffect(() => {
    const id = returnFocusTo.current
    if (selectedId !== null || id === null) return
    returnFocusTo.current = null
    const links = tableRef.current?.querySelectorAll<HTMLElement>('[data-contact-id]') ?? []
    Array.from(links).find((link) => link.dataset.contactId === id)?.focus()
  }, [selectedId])

  function handleClose() {
    returnFocusTo.current = selectedId
    setSelected(null)
  }

  function setSelected(id: string | null) {
    setParams((previous) => {
      const next = new URLSearchParams(previous)
      if (id === null) next.delete(SELECTED_PARAM)
      else next.set(SELECTED_PARAM, id)
      return next
    }, { replace: true })
  }

  const fields: FilterField<ContactFilter>[] = [
    {
      kind: 'select', name: STATUS_FILTER, label: t('contacts.page.filters.status'), allLabel: t('contacts.page.filters.allStatuses'),
      options: CONTACT_STATUSES.map((status) => ({ value: CONTACT_STATUS_SLUGS[status], label: t(`contacts.statuses.${status}`) })),
    },
    {
      kind: 'select', name: TYPE_FILTER, label: t('contacts.page.filters.type'), allLabel: t('contacts.page.filters.allTypes'),
      options: CONTACT_REQUEST_TYPES.map((type) => ({ value: CONTACT_TYPE_SLUGS[type], label: t(`contacts.types.${type}`) })),
    },
  ]
  const contacts = query.data ?? []
  const showTable = query.isSuccess && contacts.length > 0

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <PageHero
        overlap={showTable}
        title={t('contacts.page.title')}
        meta={query.isSuccess
          ? `${t('contacts.page.count', { count: contacts.length })} · ${t('contacts.page.countNew', { count: countNew(contacts) })}`
          : undefined}
        description={t('pageHero.contacts')}
      />
      <div className={showTable ? 'sky-overlap min-h-0 flex-1 overflow-auto px-shell pb-6' : 'min-h-0 flex-1 overflow-auto px-shell py-6'}>
        {query.isPending ? (
          <div className="flex justify-center py-16"><Spinner label={t('contacts.page.loading')} /></div>
        ) : query.isError ? (
          <EmptyState
            mascot="error"
            title={dataErrorMessage(query.error, t)}
            action={<Button variant="secondary" onClick={() => void query.refetch()}><RotateCcw strokeWidth={1.5} />{t('contacts.page.retry')}</Button>}
          />
        ) : contacts.length === 0 ? (
          <EmptyState mascot="empty" title={t('contacts.page.empty')} description={t('contacts.page.emptyDescription')} />
        ) : (
          <div className={cn('grid flex-none items-start gap-5', selected && 'xl:grid-cols-[minmax(0,1fr)_400px]')}>
            {/* relative: ô ẩn định vị tuyệt đối của Radix Select không thoát khung cuộn */}
            <section ref={tableRef} aria-label={t('contacts.page.title')} className="relative min-w-0 overflow-hidden rounded-lg border border-border bg-bg">
              <FilterBar
                layout="toolbar"
                className="min-h-14 border-b border-border px-4 py-2"
                query={list.query}
                onQueryChange={list.setQuery}
                searchLabel={t('contacts.page.search')}
                fields={fields}
                values={list.filters}
                onValueChange={list.setFilter}
                onClear={list.clearAll}
              />
              <DataTable
                data={rows}
                columns={columns}
                getRowId={(row: ContactRow) => row.contact.id}
                density="roomy"
                appearance="paper"
                onRowClick={(row) => setSelected(row.contact.id === selectedId ? null : row.contact.id)}
                isRowSelected={(row) => row.contact.id === selectedId}
                pagination={{ pageIndex: list.pageIndex, pageSize: list.pageSize, onPageChange: list.setPage, onPageSizeChange: list.setPageSize }}
                emptyMessage={t('contacts.page.empty')}
                isFiltering={list.isFiltering}
                onClearFilters={list.clearAll}
                noMatchMessage={t('contacts.page.noMatch')}
              />
            </section>
            {selected ? (
              <aside className="min-w-0">
                <ContactPanel
                  key={selected.contact.id}
                  row={selected}
                  handlers={handlers.data ?? []}
                  handlersError={handlers.isError}
                  onClose={handleClose}
                />
              </aside>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
