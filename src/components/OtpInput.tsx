import {
  useRef,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
} from 'react'

type OtpInputProps = {
  length?: number
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export function OtpInput({
  length = 6,
  value,
  onChange,
  disabled = false,
}: OtpInputProps) {
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const digits = Array.from(
    { length },
    (_, index) => value[index] ?? '',
  )

  function setDigit(index: number, digit: string) {
    const next = [...digits]
    next[index] = digit
    onChange(next.join(''))
  }

  function handleChange(
    index: number,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const digit = event.target.value
      .replace(/\D/g, '')
      .slice(-1)

    if (!digit) {
      setDigit(index, '')
      return
    }

    setDigit(index, digit)

    if (index < length - 1) {
      refs.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(
    index: number,
    event: KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === 'Backspace') {
      if (digits[index]) {
        setDigit(index, '')
        return
      }

      if (index > 0) {
        refs.current[index - 1]?.focus()
        setDigit(index - 1, '')
      }
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      refs.current[index - 1]?.focus()
    }

    if (
      event.key === 'ArrowRight' &&
      index < length - 1
    ) {
      refs.current[index + 1]?.focus()
    }
  }

  function handlePaste(
    event: ClipboardEvent<HTMLInputElement>,
  ) {
    event.preventDefault()

    const pasted = event.clipboardData
      .getData('text')
      .replace(/\D/g, '')
      .slice(0, length)

    if (!pasted) return

    onChange(pasted)

    const nextIndex = Math.min(
      pasted.length,
      length - 1,
    )

    refs.current[nextIndex]?.focus()
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoComplete={
            index === 0
              ? 'one-time-code'
              : 'off'
          }
          onChange={(event) =>
            handleChange(index, event)
          }
          onKeyDown={(event) =>
            handleKeyDown(index, event)
          }
          onPaste={handlePaste}
          aria-label={`OTP digit ${index + 1}`}
          className="
            h-14 w-12 rounded-lg
            border border-border
            bg-white
            text-center
            text-2xl font-semibold
            text-ink-strong
            outline-none
            transition
            focus:border-primary
            focus:ring-2
            focus:ring-primary/20
            disabled:cursor-not-allowed
            disabled:opacity-60
            sm:h-16 sm:w-14
          "
        />
      ))}
    </div>
  )
}