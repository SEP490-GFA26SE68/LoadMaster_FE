import { Eye, EyeOff } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { useEffect, useId, useState } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { disabledClass, FieldLabel, FieldMessage, fieldBoxClass, focusClass } from './field-styles'

type PasswordInputProps = Omit<ComponentProps<'input'>, 'size' | 'type'> & {
  label?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
}

/**
 * Ô mật khẩu có nút hiện / ẩn (V2.3 `DangNhap.jpg`): cùng nhãn, viền, quầng focus, gợi ý và lỗi với `Input` (`field-styles.tsx`),
 * thêm nút icon nằm trong ô. Nút là `type="button"` (không gửi form), `aria-pressed` theo trạng thái, tên truy cập đổi giữa
 * "Hiện mật khẩu" và "Ẩn mật khẩu". Nhãn của ô vẫn là `<label for>` nên tên truy cập của ô là chữ nhãn như `Input`; `className`
 * áp lên ô nhập (cỡ cảm ứng của màn), nút tự cao theo ô.
 * Khi đang hiện, ô không soát chính tả / tự sửa chữ, và tự ẩn lại lúc form gửi đi.
 */
export function PasswordInput({ className, label, hint, error, required, id, ...props }: PasswordInputProps) {
  const t = useT()
  const generatedId = useId()
  const inputId = id ?? generatedId
  const describedById = `${inputId}-mo-ta`
  const invalid = Boolean(error)
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye

  // Gửi form xong thì ẩn lại: mật khẩu đang hiện không nằm lại trên màn, và ô không ở dạng chữ lúc trình duyệt ghi nhớ giá trị form
  useEffect(() => {
    if (!visible) return
    const form = (document.getElementById(inputId) as HTMLInputElement | null)?.form
    if (!form) return
    const hide = () => setVisible(false)
    form.addEventListener('submit', hide)
    return () => form.removeEventListener('submit', hide)
  }, [visible, inputId])

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <FieldLabel htmlFor={inputId} required={required}>
          {label}
        </FieldLabel>
      ) : null}

      <div className="relative">
        <input
          id={inputId}
          type={visible ? 'text' : 'password'}
          // Khi hiện, ô là `type="text"`: tắt soát chính tả, tự sửa và tự viết hoa để mật khẩu không đi vào từ điển hay dịch vụ gợi ý của trình duyệt
          spellCheck={false}
          autoCapitalize="none"
          autoCorrect="off"
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          aria-describedby={hint || error ? describedById : undefined}
          className={cn('h-10 w-full min-w-0 py-0 pr-11 pl-3 placeholder:text-text-3', fieldBoxClass(invalid), focusClass, disabledClass, className)}
          {...props}
        />
        <button
          type="button"
          aria-pressed={visible}
          aria-label={visible ? t('auth.passwordToggle.hide') : t('auth.passwordToggle.show')}
          onClick={() => setVisible((previous) => !previous)}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-md text-ink-3 outline-none hover:text-ink-strong focus-visible:text-ink-strong focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary pointer-coarse:w-14"
        >
          <Icon aria-hidden className="size-5" strokeWidth={1.5} />
        </button>
      </div>

      <FieldMessage id={describedById} error={error} hint={hint} />
    </div>
  )
}
