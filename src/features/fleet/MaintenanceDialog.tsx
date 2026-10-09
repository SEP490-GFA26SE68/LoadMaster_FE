import { zodResolver } from '@hookform/resolvers/zod'
import { Wrench } from 'lucide-react'
import { useEffect } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Textarea } from '@/components/ui/Textarea'
import { useFormat, useT } from '@/lib/i18n'

/** Ghi chú đủ cho một dòng trên danh sách và một đoạn ở trang xe; dài hơn nên ghi ở hệ thống bảo dưỡng riêng. */
export const MAINTENANCE_NOTE_MAX = 200

/** Message là key từ điển (như form người dùng): hộp thoại dịch lúc hiển thị, đổi ngôn ngữ thì lỗi đổi theo. */
const maintenanceSchema = z.object({
  note: z.string().trim()
    .min(1, 'fleet.maintenance.noteRequired')
    .max(MAINTENANCE_NOTE_MAX, 'fleet.maintenance.noteTooLong'),
})

type MaintenanceValues = z.infer<typeof maintenanceSchema>

/**
 * Hộp thoại "Đưa vào bảo dưỡng" (LM-089, D-53): ghi chú bắt buộc. Nằm ngoài `<form>` cấu hình xe trong cây React — sự kiện
 * submit của portal vẫn lan theo cây React, lồng vào form xe sẽ kích hoạt cả nút Lưu.
 */
export function MaintenanceDialog({ open, onOpenChange, vehicleName, pending, onSubmit }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  vehicleName: string
  pending: boolean
  onSubmit: (note: string) => void
}) {
  const t = useT()
  const format = useFormat()
  const form = useForm<MaintenanceValues>({ resolver: zodResolver(maintenanceSchema), defaultValues: { note: '' } })
  const { reset } = form
  useEffect(() => {
    if (open) reset({ note: '' })
  }, [open, reset])

  const length = useWatch({ control: form.control, name: 'note' }).length
  const message = form.formState.errors.note?.message
  const error = message === 'fleet.maintenance.noteTooLong'
    ? t('fleet.maintenance.noteTooLong', { max: format.integer(MAINTENANCE_NOTE_MAX) })
    : message ? t('fleet.maintenance.noteRequired') : undefined

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-120">
        <form noValidate onSubmit={form.handleSubmit((values) => onSubmit(values.note))}>
          {/* Ô icon hổ phách: việc cần chú ý, chưa phải phá huỷ (V2.3 — HopThoaiQuanTri.jpg) */}
          <DialogHeader
            icon={Wrench}
            tone="warning"
            title={t('fleet.maintenance.title', { name: vehicleName })}
            description={t('fleet.maintenance.description')}
          />
          <div className="px-7 pt-4 pb-5">
            <Textarea
              label={t('fleet.maintenance.note')}
              placeholder={t('fleet.maintenance.notePlaceholder')}
              maxLength={MAINTENANCE_NOTE_MAX}
              aria-required
              error={error}
              // Bộ đếm là gợi ý dưới ô; lỗi thay chỗ nó như mọi ô nhập
              hint={t('fleet.maintenance.counter', { count: format.integer(length), max: format.integer(MAINTENANCE_NOTE_MAX) })}
              {...form.register('note')}
            />
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="secondary">{t('fleet.maintenance.cancel')}</Button>
            </DialogClose>
            <Button type="submit" variant="primary" loading={pending}>
              <Wrench strokeWidth={1.5} />
              {t('fleet.maintenance.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
