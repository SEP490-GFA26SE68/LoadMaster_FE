import { createColumnHelper } from '@tanstack/react-table'
import { Check, Minus } from 'lucide-react'
import { useMemo } from 'react'
import { DataTable, type BaseTableFeatures, type ColumnMeta } from '@/components/DataTable'
import { can, PERMISSIONS, type Permission } from '@/features/auth/permissions'
import { useT, type TFunction } from '@/lib/i18n'
import { ROLES } from '@/types/user'

type PermissionRow = { readonly permission: Permission }

const helper = createColumnHelper<BaseTableFeatures, PermissionRow>()
const ROWS: PermissionRow[] = PERMISSIONS.map((permission) => ({ permission }))

/**
 * Phần bề rộng bảng (%) chia đều cho các cột vai trò; cột tên quyền nhận phần còn lại. Theo tỷ lệ chứ không px cố định (AGENTS mục 5,
 * LM-095): mười cột vai trò vẫn vừa 1.366 px không cuộn ngang (FE-0-01, quyết định G13 — trước đây mỗi cột 156 px), tên vai trò xuống
 * tối đa hai dòng, và cột tên quyền còn khoảng 370 px cho nhãn dài nhất trong hai dòng.
 */
const ROLE_COLUMNS_SHARE = 72
const ROLE_COLUMN_WIDTH = `${ROLE_COLUMNS_SHARE / ROLES.length}%`

function createColumns(t: TFunction) {
  return helper.columns([
    helper.accessor('permission', {
      header: t('admin.permissions.permission'),
      cell: (info) => (
        <span className="flex min-w-0 flex-col whitespace-normal">
          <span className="line-clamp-2 font-medium text-ink-strong">{t(`admin.permissions.labels.${info.getValue()}`)}</span>
          <span className="font-mono text-caption text-ink-3">{info.getValue()}</span>
        </span>
      ),
    }),
    ...ROLES.map((role) => helper.display({
      id: role,
      // Tên vai trò xuống hai dòng: cần chiều cao dòng thật (tiêu đề cột của bảng đặt `leading-none` cho tiêu đề một dòng) và lấn 10 px
      // vào lề ô mỗi bên, để từ dài nhất ("administrator" ở bản en) vẫn nằm trọn trong cột ở 1.366 px
      header: () => <span className="-mx-2.5 block leading-4 text-balance wrap-break-word">{t(`roles.${role}`)}</span>,
      meta: { align: 'center', width: ROLE_COLUMN_WIDTH } satisfies ColumnMeta,
      cell: (info) => (can(role, info.row.original.permission) ? (
        <span className="inline-flex text-success">
          <Check className="size-5" strokeWidth={2} aria-hidden />
          <span className="sr-only">{t('admin.permissions.granted')}</span>
        </span>
      ) : (
        <span className="inline-flex text-ink-3">
          <Minus className="size-4" strokeWidth={1.5} aria-hidden />
          <span className="sr-only">{t('admin.permissions.denied')}</span>
        </span>
      )),
    })),
  ])
}

/**
 * Tab "Ma trận quyền" (LM-092, D-41): chỉ đọc, dựng thẳng từ `ROLE_PERMISSIONS` — cùng hằng số chặn route, nav và nút, nên bảng
 * luôn đúng với những gì giao diện cho phép. Ô có quyền là dấu tích, không có là gạch; trình đọc màn hình đọc "Có"/"Không".
 * Bảng V2 dạng "paper" trong một thẻ; dòng hai tầng (tên quyền + mã quyền) nên cao 56 px.
 *
 * Câu mô tả là dòng đầu của thẻ, không đứng trần phía trên: tab đè lên dải trời (`sky-overlap`), chữ trần ở đó không đọc được
 * (AGENTS mục 5). Thẻ cắt góc bằng `overflow-clip` chứ không `overflow-hidden`: 38 dòng quyền dài hơn màn hình, tiêu đề cột (tên vai
 * trò) phải dính khi cuộn, mà `overflow-hidden` biến thẻ thành khung cuộn và giữ tiêu đề lại trong thẻ.
 */
export function PermissionMatrix() {
  const t = useT()
  const columns = useMemo(() => createColumns(t), [t])
  return (
    <section className="relative flex-none overflow-clip rounded-lg border border-border bg-bg">
      <p className="border-b border-border px-3.5 py-3 text-body text-ink-2">{t('admin.permissions.description')}</p>
      <DataTable data={ROWS} columns={columns} density="roomy" appearance="paper" />
    </section>
  )
}
