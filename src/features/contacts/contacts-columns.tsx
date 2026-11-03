import { createColumnHelper } from '@tanstack/react-table'
import { Link, useLocation } from 'react-router'
import type { BaseTableFeatures, ColumnMeta } from '@/components/DataTable'
import { useFormat, useT, type TFunction } from '@/lib/i18n'
import { ContactStatusBadge, ContactTypeBadge } from './ContactBadges'
import { SELECTED_PARAM, type ContactRow } from './contact-list'
import { ContactPlan } from './ContactPlan'

const helper = createColumnHelper<BaseTableFeatures, ContactRow>()

const FOCUS = 'rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

/*
 * Component của ô khai ở mức module; hàm `cell` gọi chúng được tạo trong `createContactColumns`, nên TanStack Table v9 (dựng mỗi hàm `cell`
 * thành một component — AGENTS mục 5, Bảng dữ liệu) gỡ và gắn lại ô mỗi lần cột dựng lại. Điều đó chấp nhận được vì ô không giữ trạng thái
 * (không menu, không hộp thoại), dòng mang sẵn tên gói, và cột chỉ dựng lại khi đổi ngôn ngữ hoặc đổi tập cột (khung bên phải mở / đóng).
 */

function ReceivedCell({ row }: { row: ContactRow }) {
  const format = useFormat()
  return (
    <span className="flex flex-col font-mono text-caption tabular-nums">
      <span className="text-ink-1">{format.date(row.contact.createdAt)}</span>
      {' '}
      <span className="text-ink-3">{format.time(row.contact.createdAt)}</span>
    </span>
  )
}

/** Tên khách là liên kết mở yêu cầu ở khung bên phải (`?lien-he=`, giữ bộ lọc đang có) — mở được bằng bàn phím; dưới là mã và công ty. */
function SenderCell({ row }: { row: ContactRow }) {
  const t = useT()
  const { search } = useLocation()
  const { contact } = row
  const params = new URLSearchParams(search)
  params.set(SELECTED_PARAM, contact.id)
  return (
    <span className="flex min-w-0 flex-col items-start gap-0.5 whitespace-normal">
      <Link
        to={{ search: `?${params.toString()}` }}
        replace
        data-contact-id={contact.id}
        aria-label={t('contacts.page.open', { name: contact.fullName, id: contact.id })}
        // Dòng cũng mở khi bấm: không để cú bấm vào tên chạy cả hai lần
        onClick={(event) => event.stopPropagation()}
        className={`line-clamp-2 font-medium text-ink-strong hover:text-primary ${FOCUS}`}
      >
        {contact.fullName}
      </Link>
      <span className="line-clamp-1 text-small text-ink-3">
        <span className="font-mono text-caption">{contact.id}</span>
        {contact.companyName ? ` · ${contact.companyName}` : null}
      </span>
    </span>
  )
}

function ContactInfoCell({ row }: { row: ContactRow }) {
  return (
    <span className="flex min-w-0 flex-col gap-0.5 whitespace-normal">
      <span className="line-clamp-1 break-all text-ink-1">{row.contact.email}</span>
      {row.contact.phoneNumber ? <span className="font-mono text-caption text-ink-3 tabular-nums">{row.contact.phoneNumber}</span> : null}
    </span>
  )
}

function AssigneeCell({ row }: { row: ContactRow }) {
  const t = useT()
  return row.contact.assignedToName === undefined
    ? <span className="text-ink-3">{t('contacts.page.unassigned')}</span>
    : <span className="line-clamp-2 whitespace-normal text-ink-1">{row.contact.assignedToName}</span>
}

/**
 * Cột bảng yêu cầu liên hệ. Thứ tự là thứ tự kho trả — mới nhất trước — nên không cột nào sắp xếp. Khung bên phải đang mở (`compact`) thì
 * bỏ ba cột đã có trong khung (liên lạc, gói, người nhận việc) để bảng không phải cuộn ngang.
 */
export function createContactColumns(t: TFunction, compact: boolean) {
  const received = helper.display({
    id: 'received', header: t('contacts.page.columns.received'), meta: { width: '112px' } satisfies ColumnMeta,
    cell: (info) => <ReceivedCell row={info.row.original} />,
  })
  const sender = helper.display({
    id: 'sender', header: t('contacts.page.columns.sender'), meta: { width: compact ? '42%' : '24%' } satisfies ColumnMeta,
    cell: (info) => <SenderCell row={info.row.original} />,
  })
  const contact = helper.display({
    id: 'contact', header: t('contacts.page.columns.contact'), meta: { width: '20%' } satisfies ColumnMeta,
    cell: (info) => <ContactInfoCell row={info.row.original} />,
  })
  const type = helper.display({
    id: 'type', header: t('contacts.page.columns.type'), meta: { width: '185px' } satisfies ColumnMeta,
    cell: (info) => <ContactTypeBadge type={info.row.original.contact.requestType} />,
  })
  const plan = helper.display({
    id: 'plan', header: t('contacts.page.columns.plan'), meta: { width: '120px' } satisfies ColumnMeta,
    cell: (info) => <ContactPlan row={info.row.original} />,
  })
  const status = helper.display({
    id: 'status', header: t('contacts.page.columns.status'), meta: { width: '148px' } satisfies ColumnMeta,
    cell: (info) => <ContactStatusBadge status={info.row.original.contact.status} />,
  })
  const assignee = helper.display({
    id: 'assignee', header: t('contacts.page.columns.assignee'), cell: (info) => <AssigneeCell row={info.row.original} />,
  })
  return compact
    ? helper.columns([received, sender, type, status])
    : helper.columns([received, sender, contact, type, plan, status, assignee])
}
