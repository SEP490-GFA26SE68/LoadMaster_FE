import { zodResolver } from '@hookform/resolvers/zod'
import { PackagePlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogContent, DialogFooter, DialogHeader } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SelectField } from '@/components/ui/SelectField'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { Package } from '@/lib/mock-db'
import { TypeMeasure } from './package-look'
import { EMPTY_REGISTER, MAX_REGISTER_QUANTITY, registerFormSchema, type RegisterFormValues } from './register-form'
import { toRegisterRows, type ParsedRegisterRow } from './register-import'
import { RegisterImportPanel } from './RegisterImportPanel'
import { usePackageTypesQuery, useRegisterPackagesMutation } from './usePackagesSourceQuery'

type Mode = 'single' | 'quantity' | 'file'
const MODES: readonly Mode[] = ['single', 'quantity', 'file']

/**
 * "Đăng ký kiện" (LM-104) — ba cách: một kiện, theo số lượng (1…500 kiện cùng loại), nhập file nhiều dòng. Mọi cách đi qua
 * `useRegisterPackagesMutation`; kho kiểm hết trước khi ghi nên lỗi một dòng thì không kiện nào được tạo. Kiện thuộc công ty của người
 * đăng ký (kho lấy từ phiên, FE-0-06) nên không có ô chọn công ty. Ô Điểm đến dùng chung cho cả ba cách (trường bắt buộc của kiện
 * kho kiện, FE-3b-01); kích thước, khối lượng lấy từ loại kiện. Xong thì trả kiện vừa tạo cho màn (chọn sẵn để in nhãn).
 */
export function RegisterPackagesDialog({ onClose, onDone }: {
  onClose: () => void
  onDone: (created: Package[]) => void
}) {
  const t = useT()
  const typesQuery = usePackageTypesQuery()
  const registerMutation = useRegisterPackagesMutation()
  const [mode, setMode] = useState<Mode>('single')
  const [fileRows, setFileRows] = useState<ParsedRegisterRow[] | null>(null)
  const schema = useMemo(() => registerFormSchema(t), [t])
  const form = useForm<RegisterFormValues>({ resolver: zodResolver(schema), defaultValues: EMPTY_REGISTER })
  const { control, register, formState: { errors } } = form
  const typeId = useWatch({ control, name: 'packageTypeId' })
  const quantity = useWatch({ control, name: 'quantity' })

  const types = typesQuery.data ?? []
  const chosen = types.find((type) => type.id === typeId)
  const pending = registerMutation.isPending
  const validFile = fileRows !== null && fileRows.length > 0 && fileRows.every((row) => row.problems.length === 0)
  const fileCount = validFile ? fileRows.reduce((sum, row) => sum + (row.quantity ?? 0), 0) : 0

  function finish(created: Package[]) {
    onDone(created)
  }

  function handleValid(values: RegisterFormValues) {
    const input = {
      packageTypeId: values.packageTypeId,
      destination: values.destination,
      ...(values.reference === '' ? {} : { reference: values.reference }),
    }
    registerMutation.mutate(
      mode === 'quantity' ? { kind: 'quantity', input, quantity: values.quantity } : { kind: 'single', input },
      { onSuccess: finish },
    )
  }

  async function handleFileSubmit() {
    if (!validFile || !(await form.trigger('destination'))) return
    registerMutation.mutate({ kind: 'rows', rows: toRegisterRows(fileRows, form.getValues('destination').trim()) }, { onSuccess: finish })
  }

  const many = mode === 'file' ? fileCount : mode === 'quantity' && Number.isInteger(quantity) && quantity > 0 ? quantity : 0
  // Chưa có số hợp lệ (file lỗi, ô số lượng trống) thì nút không hứa một số kiện
  const submitLabel = many === 0 ? t('sourcing.register.submit.single') : t('sourcing.register.submit.many', { count: many })

  return (
    <Dialog open onOpenChange={(open) => (open || pending ? undefined : onClose())}>
      <DialogContent className="w-160">
        <form noValidate onSubmit={mode === 'file' ? (event) => { event.preventDefault(); void handleFileSubmit() } : form.handleSubmit(handleValid)}>
          <DialogHeader icon={PackagePlus} title={t('sourcing.register.title')} description={t('sourcing.register.description')} />
          <div className="flex max-h-[64vh] flex-col gap-4 overflow-y-auto px-7 pt-5 pb-6">
            <SegmentedControl
              ariaLabel={t('sourcing.register.modes.label')}
              floating={false}
              className="w-full [&>button]:flex-1"
              value={mode}
              onChange={(next) => {
                setMode(next)
                registerMutation.reset()
              }}
              options={MODES.map((value) => ({ value, label: t(`sourcing.register.modes.${value}`) }))}
            />

            <Input
              label={t('sourcing.register.destination')}
              placeholder={t('sourcing.register.destinationPlaceholder')}
              required
              error={errors.destination?.message}
              {...register('destination')}
            />

            {mode === 'file' ? (
              <RegisterImportPanel types={types} rows={fileRows} onRowsChange={setFileRows} />
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <SelectField
                    control={control}
                    name="packageTypeId"
                    label={t('sourcing.register.type')}
                    options={types.map((type) => ({ value: type.id, label: `${type.name} · ${type.id}` }))}
                  />
                  {chosen ? <TypeMeasure type={chosen} /> : null}
                </div>
                <div className="grid grid-cols-2 items-start gap-3">
                  {mode === 'quantity' ? (
                    <Input
                      label={t('sourcing.register.quantity')}
                      type="number"
                      min={1}
                      max={MAX_REGISTER_QUANTITY}
                      step={1}
                      numeric
                      className="text-left"
                      hint={t('sourcing.register.quantityHint', { max: MAX_REGISTER_QUANTITY })}
                      error={errors.quantity?.message}
                      {...register('quantity', { valueAsNumber: true })}
                    />
                  ) : null}
                  <Input
                    label={t('sourcing.register.reference')}
                    placeholder={t('sourcing.register.referencePlaceholder')}
                    hint={t('sourcing.register.referenceHint')}
                    className="font-mono"
                    {...register('reference')}
                  />
                </div>
              </>
            )}

            {registerMutation.error ? <Banner tone="danger">{dataErrorMessage(registerMutation.error, t)}</Banner> : null}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>{t('sourcing.register.cancel')}</Button>
            <Button type="submit" variant="primary" loading={pending} disabled={mode === 'file' && !validFile}>{submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
