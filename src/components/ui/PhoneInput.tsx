import { Check, ChevronDown } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { disabledClass, fieldBoxClass, focusWithinClass } from './field-styles'

export type PhoneCountryCode = 'VN' | 'SG' | 'US' | 'JP' | 'KR'

export type PhoneCountrySpec = {
  code: PhoneCountryCode
  name: string
  dialCode: string
  placeholder: string
  regex: RegExp
}

export const PHONE_COUNTRIES: readonly PhoneCountrySpec[] = [
  {
    code: 'VN',
    name: 'Việt Nam',
    dialCode: '+84',
    placeholder: '0988 776 655 / +84988776655',
    regex: /^(0[35789][0-9]{8}|(\+?84)[35789][0-9]{8})$/,
  },
  {
    code: 'SG',
    name: 'Singapore',
    dialCode: '+65',
    placeholder: '9123 4567 / +6591234567',
    regex: /^((\+?65)?[89][0-9]{7})$/,
  },
  {
    code: 'US',
    name: 'United States',
    dialCode: '+1',
    placeholder: '415 555 2671 / +14155552671',
    regex: /^((\+?1)?[2-9][0-9]{9})$/,
  },
  {
    code: 'JP',
    name: 'Japan',
    dialCode: '+81',
    placeholder: '090 1234 5678 / +819012345678',
    regex: /^((0|\+?81)[789]0[0-9]{8})$/,
  },
  {
    code: 'KR',
    name: 'South Korea',
    dialCode: '+82',
    placeholder: '010 1234 5678 / +821012345678',
    regex: /^((0|\+?82)10[0-9]{8})$/,
  },
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

function CountryFlagSvg({ code }: { code: PhoneCountryCode }) {
  switch (code) {
    case 'VN':
      return (
        <svg
          data-testid="country-flag-VN"
          aria-hidden="true"
          viewBox="0 0 24 16"
          className="h-3.5 w-5 shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
        >
          <rect width="24" height="16" fill="#DA251D" />
          <polygon
            fill="#FFFF00"
            points="12,3.2 13.15,6.75 16.9,6.75 13.85,8.95 15,12.5 12,10.3 9,12.5 10.15,8.95 7.1,6.75 10.85,6.75"
          />
        </svg>
      )
    case 'SG':
      return (
        <svg
          data-testid="country-flag-SG"
          aria-hidden="true"
          viewBox="0 0 24 16"
          className="h-3.5 w-5 shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
        >
          <rect width="24" height="8" fill="#EF3340" />
          <rect y="8" width="24" height="8" fill="#FFFFFF" />
          <circle cx="6.2" cy="4" r="2.6" fill="#FFFFFF" />
          <circle cx="7.1" cy="4" r="2.2" fill="#EF3340" />
        </svg>
      )
    case 'US':
      return (
        <svg
          data-testid="country-flag-US"
          aria-hidden="true"
          viewBox="0 0 24 16"
          className="h-3.5 w-5 shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
        >
          <rect width="24" height="16" fill="#B22234" />
          <rect y="2.3" width="24" height="1.8" fill="#FFFFFF" />
          <rect y="5.9" width="24" height="1.8" fill="#FFFFFF" />
          <rect y="9.5" width="24" height="1.8" fill="#FFFFFF" />
          <rect y="13.1" width="24" height="1.8" fill="#FFFFFF" />
          <rect width="10.5" height="8.8" fill="#3C3B6E" />
        </svg>
      )
    case 'JP':
      return (
        <svg
          data-testid="country-flag-JP"
          aria-hidden="true"
          viewBox="0 0 24 16"
          className="h-3.5 w-5 shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
        >
          <rect width="24" height="16" fill="#FFFFFF" />
          <circle cx="12" cy="8" r="4.2" fill="#BC002D" />
        </svg>
      )
    case 'KR':
      return (
        <svg
          data-testid="country-flag-KR"
          aria-hidden="true"
          viewBox="0 0 24 16"
          className="h-3.5 w-5 shrink-0 rounded-[2px] shadow-[0_0_0_1px_rgba(0,0,0,0.08)]"
        >
          <rect width="24" height="16" fill="#FFFFFF" />
          <circle cx="12" cy="8" r="3.8" fill="#CD2E3A" />
          <path d="M8.2,8 A3.8,3.8 0 0,0 15.8,8 A1.9,1.9 0 0,0 12,8 A1.9,1.9 0 0,1 8.2,8 Z" fill="#0047A0" />
        </svg>
      )
  }
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
        aria-label="Country code"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-l-[9px] border-r border-line-soft bg-surface/60 px-2.5 text-small font-medium text-ink-strong transition-colors hover:bg-surface focus:outline-none',
          disabledClass,
        )}
      >
        <CountryFlagSvg code={currentSpec.code} />
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
          aria-label="Select country code"
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
                  <CountryFlagSvg code={item.code} />
                  <span>{item.name}</span>
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

