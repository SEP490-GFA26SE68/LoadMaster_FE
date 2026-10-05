import { zodResolver } from '@hookform/resolvers/zod'
import { Printer } from 'lucide-react'
import { useId } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { useT } from '@/lib/i18n'
import { MANUAL_CONFIRM_REASONS, MAX_MANUAL_NOTE_LENGTH, type ManualConfirmInput } from '@/lib/mock-db'

/** Một kiện chọn được ở mức 3 của `PackageVerify`. */
export type VerifyCandidate = {
  readonly packageInstanceId: string
  readonly name: string
  /** Dòng phụ dưới tên: điểm giao, thứ tự dỡ… */
  readonly description?: string
  /** Trang in lại nhãn của kiện (mã QR giữ nguyên) — chỉ nơi có máy in nhãn truyền, tức là kho. */
  readonly reprintHref?: string
}

/** Lỗi của form là mã; component dịch. */
const ERROR_CODES = ['packageRequired', 'reasonRequired', 'noteRequired', 'noteTooLong'] as const
type ErrorCode = (typeof ERROR_CODES)[number]

const schema = z
  .object({
    packageInstanceId: z.string().min(1, 'packageRequired' satisfies ErrorCode),
    reason: z.enum(MANUAL_CONFIRM_REASONS, 'reasonRequired' satisfies ErrorCode),
    note: z.string().trim().max(MAX_MANUAL_NOTE_LENGTH, 'noteTooLong' satisfies ErrorCode),
  })
  // "Khác" không tự nói lên chuyện gì: phải có ghi chú
  .refine((values) => values.reason !== 'OTHER' || values.note !== '', { path: ['note'], message: 'noteRequired' satisfies ErrorCode })

type ManualInput = z.input<typeof schema>
type ManualValues = z.output<typeof schema>

const OPTION = 'flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-border px-3 py-2 has-checked:border-primary has-checked:bg-primary-bg has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary'
const RADIO = 'size-5 flex-none accent-primary outline-none'

/**
 * Mức 3 của đối chiếu kiện (FE-6-03, D-83): chọn kiện trong danh sách và lý do — "Nhãn rách / mất", "QR không đọc được", "Khác" (bắt
 * buộc ghi chú). Gửi đi là một xác nhận tay chờ điều phối viên duyệt. Chỉ một kiện chọn được thì kiện đó được chọn sẵn. Ô chọn 56 px,
 * chữ 16 px. Kiện đang chọn có nút "In lại nhãn" khi nơi gọi đưa đường dẫn in (kho).
 */
export function PackageVerifyManual({ candidates, pending, onSubmit }: {
  candidates: readonly VerifyCandidate[]
  pending: boolean
  onSubmit: (input: ManualConfirmInput) => void
}) {
  const t = useT()
  const id = useId()
  const form = useForm<ManualInput, unknown, ManualValues>({
    resolver: zodResolver(schema),
    defaultValues: { packageInstanceId: candidates.length === 1 ? (candidates[0]?.packageInstanceId ?? '') : '', note: '' },
  })
  const { errors } = form.formState
  const selectedId = useWatch({ control: form.control, name: 'packageInstanceId' })
  const selected = candidates.find((candidate) => candidate.packageInstanceId === selectedId)

  function message(code: string | undefined): string | undefined {
    if (!ERROR_CODES.includes(code as ErrorCode)) return undefined
    return code === 'noteTooLong' ? t('qr.verify.errors.noteTooLong', { max: MAX_MANUAL_NOTE_LENGTH }) : t(`qr.verify.errors.${code as Exclude<ErrorCode, 'noteTooLong'>}`)
  }
  const packageError = message(errors.packageInstanceId?.message)
  const reasonError = message(errors.reason?.message)
  const noteError = message(errors.note?.message)

  if (candidates.length === 0) return <p className="m-0 text-text-2">{t('qr.verify.manualEmpty')}</p>

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={form.handleSubmit(({ packageInstanceId, reason, note }) => onSubmit({ packageInstanceId, reason, ...(note === '' ? {} : { note }) }))}
    >
      <p className="m-0 text-text-2">{t('qr.verify.manualIntro')}</p>

      <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0" aria-invalid={packageError ? true : undefined}>
        <legend className="mb-1.5 p-0 font-medium">{t('qr.verify.manualPackage')}</legend>
        <div className="flex max-h-64 flex-col gap-2 overflow-y-auto p-0.5">
          {candidates.map((candidate) => (
            <label key={candidate.packageInstanceId} className={OPTION}>
              <input type="radio" value={candidate.packageInstanceId} className={RADIO} {...form.register('packageInstanceId')} />
              <span className="flex min-w-0 flex-col">
                <span className="font-mono font-semibold">{candidate.packageInstanceId}</span>
                <span className="text-text-2">{[candidate.name, candidate.description].filter(Boolean).join(' · ')}</span>
              </span>
            </label>
          ))}
        </div>
        {packageError ? <span className="text-danger">{packageError}</span> : null}
        {selected?.reprintHref ? (
          <Button asChild variant="secondary" size="touch" className="self-start">
            <Link to={selected.reprintHref}>
              <Printer strokeWidth={1.5} />
              {t('qr.verify.reprint', { id: selected.packageInstanceId })}
            </Link>
          </Button>
        ) : null}
      </fieldset>

      <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0" aria-invalid={reasonError ? true : undefined}>
        <legend className="mb-1.5 p-0 font-medium">{t('qr.verify.manualReason')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {MANUAL_CONFIRM_REASONS.map((reason) => (
            <label key={reason} className={OPTION}>
              <input type="radio" value={reason} className={RADIO} {...form.register('reason')} />
              {t(`common.manualConfirmReasons.${reason}`)}
            </label>
          ))}
        </div>
        {reasonError ? <span className="text-danger">{reasonError}</span> : null}
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-ghi-chu`} className="font-medium">{t('qr.verify.manualNote')}</label>
        <Textarea
          id={`${id}-ghi-chu`}
          rows={2}
          className="text-body-lg"
          aria-invalid={noteError ? true : undefined}
          aria-describedby={`${id}-ghi-chu-mo-ta`}
          {...form.register('note')}
        />
        <span id={`${id}-ghi-chu-mo-ta`} className={noteError ? 'text-danger' : 'text-ink-3'}>{noteError ?? t('qr.verify.manualNoteHint')}</span>
      </div>

      <Button type="submit" size="touch" className="self-end" loading={pending}>{t('qr.verify.manualSubmit')}</Button>
    </form>
  )
}
