import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { ORIENTATION_OPTIONS } from './package-form-schema'

/**
 * Ô chọn hướng đặt của form kiện (máy chủ): nút mở bảng sáu hướng, mỗi hướng một ô đánh dấu, kèm "Chọn tất cả". Chỉ đứng thẳng thì chỉ
 * còn hai hướng 0 và 2 và các ô bị khoá.
 */
export function PackageOrientationPicker({ values, uprightOnly, error, onToggle, onSelect }: {
  values: readonly number[]
  uprightOnly: boolean
  error: string | undefined
  onToggle: (value: number) => void
  onSelect: (values: number[]) => void
}) {
  const t = useT()
  const [open, setOpen] = useState(false)

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">
        {t('sourcing.form.orientation')}
      </label>

      <div className="relative">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setOpen((current) => !current)}
          className="w-full justify-between"
        >
          {values.length > 0 ? values.map((value) => `${value}`).join(', ') : t('sourcing.form.orientationSelect')}
          <span aria-hidden="true">▾</span>
        </Button>

        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-bg p-3 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm font-medium">
                {t('sourcing.form.orientation')}
              </span>

              <button
                type="button"
                className="text-sm text-primary hover:underline"
                onClick={() => onSelect(uprightOnly ? [0, 2] : [0, 1, 2, 3, 4, 5])}
              >
                {t('sourcing.form.orientationSelectAll')}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {ORIENTATION_OPTIONS.map((option) => {
                const disabled = uprightOnly && option.value !== 0 && option.value !== 2

                return (
                  <label
                    key={option.value}
                    className={`flex items-start gap-2 text-sm ${disabled ? 'opacity-40' : 'cursor-pointer'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={values.includes(option.value)}
                      disabled={uprightOnly}
                      onChange={() => onToggle(option.value)}
                    />

                    <span>
                      <span className="font-medium">
                        {t('sourcing.form.orientationDirection', { number: option.value })}
                      </span>
                      <span className="block text-ink-3">
                        {option.dimensions}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-500">
          {error}
        </p>
      )}
    </div>
  )
}
