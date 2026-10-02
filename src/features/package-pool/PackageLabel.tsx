import { Wine } from 'lucide-react'
import type { ReactNode } from 'react'
import { LogoMark } from '@/components/brand/LogoMark'
import { QrCode } from '@/components/QrCode'
import { useFormat, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { LABEL_SHEET } from './label-sheet'
import type { PackageLabel as PackageLabelData } from './package-pool-api'

/** Bề rộng và chiều cao nhãn theo `em` của cỡ chữ gốc (`label-sheet.ts`): bản in gốc 4 mm, bản xem trên màn gốc 16 px. */
const WIDTH_EM = LABEL_SHEET.labelWidthMm / LABEL_SHEET.baseMm
const HEIGHT_EM = LABEL_SHEET.labelHeightMm / LABEL_SHEET.baseMm

/**
 * Một nhãn QR để dán lên kiện (LM-104, mẫu mới FE-3b-05): mã QR kèm mã chữ để gõ tay khi không quét được, mã của bên gửi, loại hàng,
 * kích thước (cm), khối lượng (kg), điểm đến, mã của kho kiện và công ty của kiện; kiện `FRAGILE` thêm dòng "Hàng dễ vỡ". Chữ dài
 * (mã, điểm đến) xuống dòng chứ không cắt. Góc trên có logo một màu (LM-105): in đen trắng vẫn rõ — nhãn không dùng nền màu, chỉ viền
 * và chữ. Cùng một component cho bản xem trên màn và bản in (`print`).
 */
export function PackageLabel({ label, print = false }: { label: PackageLabelData; print?: boolean }) {
  const t = useT()
  const format = useFormat()
  const { package: pkg, type, owner } = label
  return (
    <article
      aria-label={pkg.id}
      style={{ width: `${WIDTH_EM}em`, ...(print ? { height: `${HEIGHT_EM}em`, fontSize: `${LABEL_SHEET.baseMm}mm` } : {}) }}
      className={cn(
        'flex max-w-full flex-col gap-[0.6em] border border-n-900 bg-bg p-[1em] text-text',
        print ? 'break-inside-avoid rounded-none' : 'rounded-md text-body-lg',
      )}
    >
      <header className="flex items-center justify-between gap-[0.5em]">
        <span aria-hidden className="flex flex-none items-center gap-[0.3em] text-ink-strong">
          <LogoMark tone="mono" className="size-[1.4em]" />
          <span className="font-display text-[0.8em] leading-none font-bold font-stretch-106%">LoadMaster</span>
        </span>
        <span className="font-mono text-[0.85em] leading-none font-semibold tabular-nums">{pkg.id}</span>
      </header>

      <div className="flex items-start gap-[0.8em]">
        <div className="flex flex-none flex-col items-center gap-[0.3em]">
          <QrCode token={pkg.qrToken} size="9em" />
          <span className="font-mono text-[0.72em] leading-none font-semibold tabular-nums">{pkg.qrToken}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-[0.5em]">
          <Field name={t('qr.label.senderCode')}>
            <span className="font-mono text-[1.05em] leading-[1.2] font-semibold wrap-anywhere">{pkg.packageCode}</span>
          </Field>
          <Field name={t('qr.label.handlingClass')}>
            <span className="text-[1em] leading-[1.2] font-semibold">{t(`common.handlingClasses.${pkg.handlingClass}`)}</span>
          </Field>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[0.6em] border-t border-n-900 pt-[0.5em]">
        <Field name={t('qr.label.dimensions')}>
          <span className="font-mono text-[0.9em] leading-[1.2] font-semibold tabular-nums">{format.dimensions(pkg.lengthCm, pkg.widthCm, pkg.heightCm)}</span>
        </Field>
        <Field name={t('qr.label.weight')}>
          <span className="font-mono text-[0.9em] leading-[1.2] font-semibold tabular-nums">{format.weight(pkg.weightKg)}</span>
        </Field>
      </div>

      <Field name={t('qr.label.destination')}>
        <span className="text-[1em] leading-[1.25] font-semibold wrap-anywhere">{pkg.destination}</span>
      </Field>

      {pkg.handlingClass === 'FRAGILE' ? (
        <p className="m-0 flex items-center justify-center gap-[0.4em] border-[0.14em] border-n-900 px-[0.6em] py-[0.35em] text-[1.3em] leading-none font-semibold">
          <Wine aria-hidden className="size-[1em] flex-none" strokeWidth={1.75} />
          {t('qr.label.fragile')}
        </p>
      ) : null}

      <footer className="mt-auto flex flex-col gap-[0.15em] text-[0.7em] leading-[1.25] text-ink-2">
        {type ? <span className="wrap-anywhere">{type.name}</span> : null}
        {owner ? <span className="wrap-anywhere">{owner.name}</span> : null}
      </footer>
    </article>
  )
}

/** Một trường của nhãn: tên trường nhỏ phía trên, giá trị phía dưới. */
function Field({ name, children }: { name: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-[0.15em]">
      <span className="text-[0.7em] leading-none text-ink-2">{name}</span>
      {children}
    </div>
  )
}
