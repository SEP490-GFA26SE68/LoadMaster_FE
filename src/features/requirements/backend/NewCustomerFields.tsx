import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { dataErrorMessage, useT } from '@/lib/i18n'
import type { CreateCustomerInput } from './customers-api'

/**
 * Khối "Thêm khách hàng" ngay trong form yêu cầu giao (máy chủ): ba ô tên, điện thoại, địa chỉ cùng nút lưu và huỷ. Giá trị đang nhập do
 * form cha giữ, nên huỷ rồi mở lại vẫn còn chữ đã gõ.
 */
export function NewCustomerFields({ value, onChange, onSave, onCancel, pending, error }: {
  value: CreateCustomerInput
  onChange: (next: CreateCustomerInput) => void
  onSave: () => void
  onCancel: () => void
  pending: boolean
  error: Error | null
}) {
  const t = useT()
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
      <Input
        label={t('requirements.customer.name')}
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        maxLength={150}
      />
      <Input
        label={t('requirements.customer.phone')}
        value={value.contactPhone}
        onChange={(event) => onChange({ ...value, contactPhone: event.target.value })}
        maxLength={20}
      />
      <Input
        label={t('requirements.customer.address')}
        value={value.address}
        onChange={(event) => onChange({ ...value, address: event.target.value })}
        maxLength={255}
      />

      {error ? <Banner tone="danger">{dataErrorMessage(error, t)}</Banner> : null}

      <div className="flex gap-2">
        <Button type="button" loading={pending} onClick={onSave}>
          {t('requirements.customer.save')}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('requirements.form.cancel')}
        </Button>
      </div>
    </div>
  )
}
