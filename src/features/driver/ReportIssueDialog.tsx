import { zodResolver } from '@hookform/resolvers/zod'
import { useId } from 'react'
import { useForm } from 'react-hook-form'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { useT } from '@/lib/i18n'
import { DELIVERY_ISSUE_KINDS } from '@/lib/mock-db'
import type { ItemProgress } from './delivery-progress'
import { ISSUE_NOTE_MAX, isIssueFormError, issueFormSchema, type IssueFormInput, type IssueFormValues } from './issue-form.schema'

type IssueFormProps = {
  stopNumber: number
  /** Kiện của điểm đang giao; chọn sẵn kiện chưa dỡ, chưa có sự cố đầu tiên. */
  items: readonly ItemProgress[]
  pending: boolean
  /** Ghi sự cố vào kho; hộp đóng khi ghi xong (nơi gọi đóng). */
  onSubmit: (values: IssueFormValues) => Promise<void>
}

/**
 * Hộp "Báo sự cố" (LM-087, D-47): chọn kiện, loại sự cố (hỏng / thiếu / khách từ chối / khác) và ghi chú; "Khác" bắt buộc ghi chú.
 * Điện thoại: tờ trượt từ đáy, chữ 16px, ô chọn và nút 56px, bốn loại là bốn ô bấm lớn có viền cyan khi chọn (mục 10); nội dung cuộn bên trong,
 * hai nút ở chân tờ luôn trong tầm ngón cái. Form dựng lại mỗi lần mở để kiện chọn sẵn đúng lúc mở.
 */
export function ReportIssueDialog({ open, onOpenChange, ...form }: IssueFormProps & { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        // Điện thoại: tờ trượt từ đáy (V2.3 đợt 6); từ 768px là hộp thoại giữa màn rộng tối đa 640px
        <DialogContent sheet className="w-[min(40rem,calc(100vw-3rem))]">
          <IssueForm {...form} />
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function IssueForm({ stopNumber, items, pending, onSubmit }: IssueFormProps) {
  const t = useT()
  const id = useId()
  const preselected = items.find((entry) => !entry.unloaded && entry.issue === undefined) ?? items[0]
  const form = useForm<IssueFormInput, unknown, IssueFormValues>({
    resolver: zodResolver(issueFormSchema),
    defaultValues: { packageInstanceId: preselected?.item.id ?? '', note: '' },
  })
  const { errors } = form.formState

  function message(code: string | undefined): string | undefined {
    if (!isIssueFormError(code)) return undefined
    return code === 'noteTooLong' ? t('driver.issue.errors.noteTooLong', { max: ISSUE_NOTE_MAX }) : t(`driver.issue.errors.${code}`)
  }
  const packageError = message(errors.packageInstanceId?.message)
  const kindError = message(errors.kind?.message)
  const noteError = message(errors.note?.message)

  return (
    <form noValidate className="text-body-lg" onSubmit={form.handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-5 px-5 pt-3 pb-5 md:px-6 md:pt-6">
        <div className="flex flex-col gap-1">
          <DialogTitle className="font-display text-h2 leading-6.5 font-bold text-ink-strong font-stretch-106%">{t('driver.issue.title', { number: stopNumber })}</DialogTitle>
          <DialogDescription className="text-body-lg text-pretty text-ink-2">{t('driver.issue.description')}</DialogDescription>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-kien`} className="font-semibold text-ink-2">{t('driver.issue.package')}</label>
          <select
            id={`${id}-kien`}
            aria-invalid={packageError ? true : undefined}
            className="h-14 w-full rounded-md border border-line-strong bg-bg px-3 font-mono text-body-lg outline-none focus-visible:border-cyan-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            {...form.register('packageInstanceId')}
          >
            {items.map(({ item }) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}
          </select>
          {packageError ? <span className="text-danger">{packageError}</span> : null}
        </div>

        <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0" aria-invalid={kindError ? true : undefined}>
          <legend className="mb-1.5 p-0 font-semibold text-ink-2">{t('driver.issue.kind')}</legend>
          <div className="grid grid-cols-2 gap-2">
            {DELIVERY_ISSUE_KINDS.map((kind) => (
              <label
                key={kind}
                className="flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-line-strong px-3 font-medium has-checked:border-cyan-500 has-checked:bg-cyan-50 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary"
              >
                <input type="radio" value={kind} className="size-5 flex-none accent-primary outline-none" {...form.register('kind')} />
                {t(`common.deliveryIssueKinds.${kind}`)}
              </label>
            ))}
          </div>
          {kindError ? <span className="text-danger">{kindError}</span> : null}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-ghi-chu`} className="font-semibold text-ink-2">{t('driver.issue.note')}</label>
          <Textarea
            id={`${id}-ghi-chu`}
            rows={3}
            className="text-body-lg"
            aria-invalid={noteError ? true : undefined}
            aria-describedby={`${id}-ghi-chu-mo-ta`}
            {...form.register('note')}
          />
          <span id={`${id}-ghi-chu-mo-ta`} className={noteError ? 'text-danger' : 'text-ink-3'}>{noteError ?? t('driver.issue.noteHint')}</span>
        </div>
      </div>

      <DialogFooter className="sticky bottom-0 justify-end px-5 md:px-6">
        <DialogClose asChild>
          <Button type="button" variant="secondary" size="touch" className="max-md:flex-1">{t('driver.issue.cancel')}</Button>
        </DialogClose>
        <Button type="submit" variant="primary" size="touch" className="max-md:flex-1" loading={pending}>{t('driver.issue.submit')}</Button>
      </DialogFooter>
    </form>
  )
}
