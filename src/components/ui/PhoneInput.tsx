import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { disabledClass, fieldBoxClass, focusWithinClass } from './field-styles'

export type PhoneCountryCode = 'VN' | 'SG' | 'US' | 'JP' | 'KR'

/** Mã vùng được chọn; tên nước đọc từ `common.phoneInput.countries` theo `code`. */
export type PhoneCountrySpec = {
  code: PhoneCountryCode
  dialCode: string
  placeholder: string
  regex: RegExp
}

export const PHONE_COUNTRIES: readonly PhoneCountrySpec[] = [
  { code: 'VN', dialCode: '+84', placeholder: '0988 776 655 / +84988776655', regex: /^(0[35789][0-9]{8}|(\+?84)[35789][0-9]{8})$/ },
  { code: 'SG', dialCode: '+65', placeholder: '9123 4567 / +6591234567', regex: /^((\+?65)?[89][0-9]{7})$/ },
  { code: 'US', dialCode: '+1', placeholder: '415 555 2671 / +14155552671', regex: /^((\+?1)?[2-9][0-9]{9})$/ },
  { code: 'JP', dialCode: '+81', placeholder: '090 1234 5678 / +819012345678', regex: /^((0|\+?81)[789]0[0-9]{8})$/ },
  { code: 'KR', dialCode: '+82', placeholder: '010 1234 5678 / +821012345678', regex: /^((0|\+?82)10[0-9]{8})$/ },
]

export function isPhoneValidForCountry(phoneNumber: string, country: PhoneCountryCode): boolean {
  const cleaned = phoneNumber.replace(/[\s.-]/g, '')
  if (!cleaned) return false
  const spec = PHONE_COUNTRIES.find((c) => c.code === country) ?? (PHONE_COUNTRIES[0] as PhoneCountrySpec)
  if (!spec || !spec.regex.test(cleaned)) return false
  if (country === 'VN' && /^(\d)\1{7}$/.test(cleaned.slice(-8))) {
    return false
  }
  return true
}

type PhoneInputProps = {
  id?: string
  country: PhoneCountryCode
  onCountryChange: (country: PhoneCountryCode) => void
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  className?: string
}

/**
 * Ô số điện thoại kèm nút chọn mã vùng. Nước hiện bằng mã ISO (VN, SG…) và mã vùng, không vẽ cờ: màu cờ nằm ngoài bảng token.
 */
export function PhoneInput({
  id,
  country,
  onCountryChange,
  value,
  onChange,
  placeholder,
  disabled,
  invalid = false,
  className,
}: PhoneInputProps) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const currentSpec = (PHONE_COUNTRIES.find((c) => c.code === country) ?? PHONE_COUNTRIES[0]) as PhoneCountrySpec

  useEffect(() => {
    if (!open) return
    function handleOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [open])

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex h-10 w-full items-stretch',
        fieldBoxClass(invalid),
        focusWithinClass,
        disabled && 'border-n-200 bg-n-50 text-n-600',
        className,
      )}
    >
      <button
        type="button"
        aria-label={t('common.phoneInput.countryCode')}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-l-[9px] border-r border-line-soft bg-surface/60 px-2.5 text-small font-medium text-ink-strong transition-colors hover:bg-surface focus:outline-none',
          disabledClass,
        )}
      >
        <span className="font-mono text-caption text-ink-2">{currentSpec.code}</span>
        <span className="font-mono text-small text-ink-strong">{currentSpec.dialCode}</span>
        <ChevronDown className="size-3.5 text-n-600" strokeWidth={1.75} />
      </button>

      <input
        id={id}
        type="tel"
        inputMode="tel"
        disabled={disabled}
        aria-invalid={invalid || undefined}
        placeholder={placeholder ?? currentSpec.placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9+\s.-]/g, ''))}
        className={cn(
          'h-full min-w-0 flex-1 rounded-r-[9px] border-none bg-transparent px-3 text-body text-text placeholder:text-text-3 outline-none',
          disabledClass,
        )}
      />

      {open && (
        <div
          role="listbox"
          aria-label={t('common.phoneInput.countryList')}
          className="absolute top-[calc(100%+6px)] left-0 z-50 min-w-56 overflow-hidden rounded-lg border border-border bg-bg p-1.5 shadow-e2"
        >
          {PHONE_COUNTRIES.map((item) => {
            const selected = item.code === country
            return (
              <button
                key={item.code}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  onCountryChange(item.code)
                  setOpen(false)
                }}
                className={cn(
                  'flex h-9 w-full items-center justify-between gap-2.5 rounded-md px-2.5 text-left text-small text-text transition-colors hover:bg-surface',
                  selected && 'bg-primary-bg font-medium text-ink-strong',
                )}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-6 font-mono text-caption text-ink-3">{item.code}</span>
                  <span>{t(`common.phoneInput.countries.${item.code}`)}</span>
                  <span className="font-mono text-caption text-ink-3">({item.dialCode})</span>
                </span>
                {selected && <Check className="size-4 shrink-0 text-primary" strokeWidth={1.75} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
