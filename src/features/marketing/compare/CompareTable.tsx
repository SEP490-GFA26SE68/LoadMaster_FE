import { Boxes, CircleCheck, FileChartColumn, FileSpreadsheet, Layers3, MapPinned, Scale, ScanLine, type LucideIcon } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Reveal, RevealWords } from '../reveal'

/** Sáu việc của một chuyến hàng, theo thứ tự của chuyến; câu ở `landingCompare.rows.<id>`. */
export const COMPARE_ROWS = ['plan', 'axle', 'unload', 'verify', 'track', 'report'] as const
export type CompareRowId = (typeof COMPARE_ROWS)[number]

const ROW_ICON: Readonly<Record<CompareRowId, LucideIcon>> = {
  plan: Boxes,
  axle: Scale,
  unload: Layers3,
  verify: ScanLine,
  track: MapPinned,
  report: FileChartColumn,
}

const CELL = 'block align-top md:table-cell md:px-5 md:py-5 lg:px-6'
const COLUMN_HEAD = 'px-5 py-4 text-left align-bottom text-body font-semibold lg:px-6'
/** Nhãn cột hiện trong thẻ của một việc dưới 768 px; bảng đã có tiêu đề cột cho trình đọc màn hình nên nhãn này `aria-hidden`. */
const CARD_LABEL = 'mb-1.5 flex items-center gap-1.5 text-small font-semibold pointer-coarse:text-body-lg md:hidden'

function CompareRow({ id }: { id: CompareRowId }) {
  const t = useT()
  const Icon = ROW_ICON[id]
  return (
    <tr role="row" className="flex flex-col overflow-hidden rounded-lg border border-border bg-bg shadow-card md:table-row md:rounded-none md:border-0 md:border-t md:border-line-soft md:shadow-none">
      <th role="rowheader" scope="row" className={cn(CELL, 'px-4 pt-4 pb-3 text-left font-normal')}>
        <Reveal className="flex items-center gap-3 md:flex-col md:items-start">
          <span aria-hidden className="grid size-10 flex-none place-items-center rounded-md bg-tint-blue text-tint-blue-fg">
            <Icon className="size-5" strokeWidth={1.5} />
          </span>
          <span className="font-display text-h3 font-[650] text-balance text-ink-strong font-stretch-106% pointer-coarse:text-body-lg">
            {t(`landingCompare.rows.${id}.job`)}
          </span>
        </Reveal>
      </th>
      <td role="cell" className={cn(CELL, 'px-4 pb-4')}>
        <Reveal index={1} kind="fade">
          <span aria-hidden className={cn(CARD_LABEL, 'text-ink-3')}>
            <FileSpreadsheet className="size-4" strokeWidth={1.5} />
            {t('landingCompare.table.manual')}
          </span>
          <p className="m-0 text-body-lg text-pretty text-ink-2">{t(`landingCompare.rows.${id}.manual`)}</p>
        </Reveal>
      </td>
      <td role="cell" className={cn(CELL, 'bg-primary-bg px-4 py-4')}>
        <Reveal index={2} kind="fade">
          <span aria-hidden className={cn(CARD_LABEL, 'text-primary')}>
            <CircleCheck className="size-4" strokeWidth={1.5} />
            {t('landingCompare.table.app')}
          </span>
          <RevealWords as="p" mode="ink" text={t(`landingCompare.rows.${id}.app`)} className="m-0 text-body-lg text-pretty text-ink-1" />
        </Reveal>
      </td>
    </tr>
  )
}

/**
 * Bảng so từng việc: một `<table>` thật — tiêu đề cột `scope="col"`, tên việc là tiêu đề dòng `scope="row"` — để trình đọc màn hình đọc
 * được quan hệ dòng / cột. Từ 768 px là bảng ba cột trong một thẻ, cột LoadMaster nền `--primary-bg`; hẹp hơn mỗi việc thành một thẻ xếp
 * dọc (không cuộn ngang), hàng tiêu đề cột chỉ còn cho trình đọc màn hình và mỗi ô có nhãn cột nhìn thấy được (`aria-hidden`). Đổi `display`
 * của phần tử bảng làm vài trình duyệt bỏ vai trò bảng, nên mỗi phần tử khai lại `role` của chính nó. Cuộn tới thì từng ô hiện ra so le
 * theo cột, câu của cột LoadMaster đậm dần từng từ.
 */
export function CompareTable() {
  const t = useT()
  return (
    <div className="md:overflow-hidden md:rounded-lg md:border md:border-border md:bg-bg md:shadow-card">
      <table role="table" className="block w-full md:table md:table-fixed md:border-collapse">
        <caption className="sr-only">{t('landingCompare.table.caption')}</caption>
        <thead role="rowgroup" className="max-md:sr-only md:table-header-group">
          <tr role="row">
            <th role="columnheader" scope="col" className={cn(COLUMN_HEAD, 'w-[24%] text-ink-3')}>{t('landingCompare.table.job')}</th>
            <th role="columnheader" scope="col" className={cn(COLUMN_HEAD, 'w-[34%] text-ink-2')}>
              <span className="flex items-center gap-2">
                <FileSpreadsheet aria-hidden className="size-5 flex-none text-ink-3" strokeWidth={1.5} />
                {t('landingCompare.table.manual')}
              </span>
            </th>
            <th role="columnheader" scope="col" className={cn(COLUMN_HEAD, 'border-t-2 border-primary bg-primary-bg text-primary')}>
              <span className="flex items-center gap-2">
                <CircleCheck aria-hidden className="size-5 flex-none" strokeWidth={1.5} />
                {t('landingCompare.table.app')}
              </span>
            </th>
          </tr>
        </thead>
        <tbody role="rowgroup" className="flex flex-col gap-4 md:table-row-group">
          {COMPARE_ROWS.map((id) => <CompareRow key={id} id={id} />)}
        </tbody>
      </table>
    </div>
  )
}
