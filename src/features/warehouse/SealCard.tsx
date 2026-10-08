import { zodResolver } from '@hookform/resolvers/zod'
import { Lock } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { dataErrorMessage, useFormat, useT } from '@/lib/i18n'
import { MAX_SEAL_LENGTH, type Trip } from '@/lib/mock-db'
import { useRecordSealMutation } from './useWarehouseQueries'

/** Message là key từ điển: đổi ngôn ngữ thì lỗi đổi theo. */
const sealSchema = z.object({
  number: z.string().trim().min(1, 'warehouse.seal.required').max(MAX_SEAL_LENGTH, 'warehouse.seal.tooLong'),
})

type SealValues = z.infer<typeof sealSchema>

/**
 * Niêm phong thùng khi xếp xong (luồng 5 Review 1, LM-104). Số seal không bắt buộc; có thì kho ghi vào chuyến (`loading.seal`) và báo
 * cáo chuyến in ra. Chỉ ghi / đổi được khi chuyến còn ở kho (`loaded`); xe đã rời kho thì chỉ đọc. Chưa ghi seal thì nút ghi là nút
 * chính của màn Xếp xong (`primary`), ghi rồi thì nút chính trở về "Về danh sách chuyến".
 */
export function SealCard({ trip }: { trip: Pick<Trip, 'id' | 'phase' | 'loading'> }) {
  const t = useT()
  const format = useFormat()
  const seal = trip.loading?.seal
  const editable = trip.phase === 'loaded'
  const [editing, setEditing] = useState(false)
  const record = useRecordSealMutation(trip.id)
  const form = useForm<SealValues>({ resolver: zodResolver(sealSchema), defaultValues: { number: seal?.number ?? '' } })

  const message = form.formState.errors.number?.message
  const error = message === 'warehouse.seal.tooLong'
    ? t('warehouse.seal.tooLong', { max: MAX_SEAL_LENGTH })
    : message ? t('warehouse.seal.required') : undefined
  const showForm = editable && (seal === undefined || editing)

  function handleSubmit({ number }: SealValues) {
    record.mutate(number, {
      onSuccess: () => {
        setEditing(false)
        toast.success(t('warehouse.seal.saved', { number }))
      },
      onError: (failure) => toast.error(dataErrorMessage(failure, t)),
    })
  }

  return (
    <section aria-labelledby="niem-phong" className="flex w-full flex-col gap-3 rounded-lg border border-line-soft bg-surface p-4">
      <h2 id="niem-phong" className="flex items-center gap-2 font-display text-h3 font-[650] text-ink-strong font-stretch-106%">
        <Lock className="size-5 flex-none text-primary" strokeWidth={1.5} aria-hidden />
        {t('warehouse.seal.title')}
      </h2>
      {seal ? (
        <p className="m-0 font-medium">
          {t('warehouse.seal.recorded', { number: seal.number, time: format.time(seal.at) })}
        </p>
      ) : !editable ? (
        <p className="m-0 text-text-2">{t('warehouse.seal.none')}</p>
      ) : null}

      {showForm ? (
        <form noValidate className="flex flex-col gap-3" onSubmit={form.handleSubmit(handleSubmit)}>
          <p className="m-0 text-text-2">{t('warehouse.seal.description')}</p>
          <Input
            label={t('warehouse.seal.label')}
            hint={t('warehouse.seal.hint', { max: MAX_SEAL_LENGTH })}
            error={error}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            className="h-14 font-mono text-body-lg"
            {...form.register('number')}
          />
          <Button type="submit" variant={seal ? 'secondary' : 'primary'} size="touch" className="self-start" loading={record.isPending}>
            {t('warehouse.seal.submit')}
          </Button>
        </form>
      ) : editable ? (
        <Button type="button" variant="secondary" size="touch" className="self-start" onClick={() => setEditing(true)}>
          {t('warehouse.seal.change')}
        </Button>
      ) : seal ? (
        <p className="m-0 text-text-3">{t('warehouse.seal.locked')}</p>
      ) : null}
    </section>
  )
}
