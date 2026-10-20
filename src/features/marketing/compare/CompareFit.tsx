import { CircleCheck, FileSpreadsheet, Info, MapPin, Truck, Users, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { IMPORT_COLUMNS, OPTIONAL_COLUMNS } from '@/features/package-pool/package-pool-import'
import { useT } from '@/lib/i18n'
import { LineRise, Reveal } from '../reveal'

const FIT = ['fleet', 'team', 'cargo'] as const

const CARD_TITLE = 'm-0 font-display text-h2 font-[650] tracking-[-0.2px] text-ink-strong font-stretch-108%'
const ITEM_TEXT = 'm-0 text-body-lg text-pretty text-ink-2'
/** Các ý trong thẻ bắt đầu nhô lên sau khi tiêu đề thẻ bắt đầu lên khỏi mặt nạ chừng này (ms). */
const ITEM_DELAY_MS = 180

/**
 * Một thứ cần chuẩn bị: icon trên nền tint slate (ngữ cảnh, không phải số đo), tên, câu mô tả và phần thêm nếu có. Nhô lên theo thẻ chứa
 * nó, so le `index` bậc sau tiêu đề thẻ.
 */
function PrepareItem({ icon: Icon, title, text, index, children }: { icon: LucideIcon; title: string; text: string; index: number; children?: ReactNode }) {
  return (
    <Reveal as="li" index={index} delay={ITEM_DELAY_MS} className="flex gap-3.5">
      <span aria-hidden className="grid size-10 flex-none place-items-center rounded-md bg-tint-slate text-tint-slate-fg">
        <Icon className="size-5" strokeWidth={1.5} />
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <h4 className="m-0 text-body-lg font-semibold text-ink-strong">{title}</h4>
        <p className={ITEM_TEXT}>{text}</p>
        {children}
      </div>
    </Reveal>
  )
}

/** Cột của file kiện mẫu: đúng tiêu đề cột của file mẫu (`sourcing.import.header`) theo `IMPORT_COLUMNS` của bộ nhập kho kiện. */
function TemplateColumns() {
  const t = useT()
  return (
    <ul aria-label={t('landingCompare.prepare.packages.columns')} className="m-0 mt-1.5 flex list-none flex-wrap gap-1.5 p-0">
      {IMPORT_COLUMNS.map((column) => {
        const header = t(`sourcing.import.header.${column}`)
        return (
          <li key={column} className="rounded-sm border border-border bg-surface px-2 py-0.5 text-small font-medium text-ink-1 pointer-coarse:text-body-lg">
            {OPTIONAL_COLUMNS.includes(column) ? t('landingCompare.prepare.packages.optional', { column: header }) : header}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Dưới bảng so sánh: "Phù hợp với" (ba ý, cuối thẻ là dòng "Chưa có" nói thẳng điều ứng dụng không làm — chỉ điều đã kiểm là không có) và
 * "Cần chuẩn bị" (xe, kiện theo file mẫu, điểm giao, người dùng và thiết bị). Hai thẻ cạnh nhau từ 1.024 px, nhô lên so le khi cuộn tới;
 * trong thẻ, tiêu đề lên khỏi mặt nạ rồi từng ý nhô lên cách nhau 70 ms.
 */
export function CompareFit() {
  const t = useT()
  return (
    <div className="mt-10 grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-5">
      <Reveal className="flex min-w-0 flex-col">
        <Card className="flex flex-1 flex-col gap-5 p-5 sm:p-7">
          <LineRise as="h3" className={CARD_TITLE} lines={[t('landingCompare.fit.title')]} />
          <ul className="m-0 flex list-none flex-col gap-4 p-0">
            {FIT.map((id, index) => (
              <Reveal as="li" key={id} index={index} delay={ITEM_DELAY_MS} className="flex gap-3">
                <CircleCheck aria-hidden className="mt-0.5 size-5 flex-none text-primary" strokeWidth={1.5} />
                <p className={ITEM_TEXT}>{t(`landingCompare.fit.items.${id}`)}</p>
              </Reveal>
            ))}
          </ul>
          <div className="mt-auto flex gap-3 rounded-md border border-line-soft bg-surface p-4">
            <Info aria-hidden className="mt-0.5 size-5 flex-none text-ink-3" strokeWidth={1.5} />
            <div className="flex min-w-0 flex-col gap-0.5">
              <h4 className="m-0 text-body-lg font-semibold text-ink-strong">{t('landingCompare.missing.title')}</h4>
              <p className={ITEM_TEXT}>{t('landingCompare.missing.text')}</p>
            </div>
          </div>
        </Card>
      </Reveal>
      <Reveal index={1} className="flex min-w-0 flex-col">
        <Card className="flex flex-1 flex-col gap-5 p-5 sm:p-7">
          <LineRise as="h3" className={CARD_TITLE} lines={[t('landingCompare.prepare.title')]} />
          <ul className="m-0 flex list-none flex-col gap-5 p-0">
            <PrepareItem index={0} icon={Truck} title={t('landingCompare.prepare.vehicles.title')} text={t('landingCompare.prepare.vehicles.text')} />
            <PrepareItem index={1} icon={FileSpreadsheet} title={t('landingCompare.prepare.packages.title')} text={t('landingCompare.prepare.packages.text')}>
              <TemplateColumns />
            </PrepareItem>
            <PrepareItem index={2} icon={MapPin} title={t('landingCompare.prepare.stops.title')} text={t('landingCompare.prepare.stops.text')} />
            <PrepareItem index={3} icon={Users} title={t('landingCompare.prepare.people.title')} text={t('landingCompare.prepare.people.text')} />
          </ul>
        </Card>
      </Reveal>
    </div>
  )
}
