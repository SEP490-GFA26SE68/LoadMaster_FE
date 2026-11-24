import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowUp } from 'lucide-react'
import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { CHAT_TOUCH } from './AssistantChips'

export const QUESTION_MAX = 300
/** Mã của ô gõ: khung chat đặt focus vào đây khi mở và khi bắt đầu lại. */
export const ASSISTANT_INPUT_ID = 'tro-ly-lumo-cau-hoi'

/** Đặt focus vào ô gõ câu hỏi (nếu khung đang mở). */
export function focusAssistantInput() {
  document.getElementById(ASSISTANT_INPUT_ID)?.focus()
}

const questionSchema = z.object({ question: z.string().trim().min(1).max(QUESTION_MAX) })
type QuestionInput = z.input<typeof questionSchema>

/**
 * Ô gõ câu hỏi: một khung bo góc chứa ô gõ và nút gửi. Ô gõ tự cao theo chữ (tối đa bốn dòng, quá thì cuộn trong ô); Enter là gửi,
 * Shift + Enter xuống dòng — xuống dòng gộp thành dấu cách khi gửi. Nút gửi là nút chính của khung chat (nút chính của trang vẫn là của
 * trang): ô trống thì mờ, có chữ thì sáng; đang chờ câu trả lời thì vẫn gõ được nhưng chưa gửi. Focus: viền khung đổi cyan và dày thêm 1 px
 * — một vòng mảnh, không chồng quầng lên vòng. `children` là dòng chữ nhỏ dưới khung (Lumo trả lời từ tài liệu, không phải nhân viên).
 */
export function AssistantComposer({ onSend, pending, children }: { onSend: (question: string) => void; pending: boolean; children?: ReactNode }) {
  const t = useT()
  const inputId = ASSISTANT_INPUT_ID
  const box = useRef<HTMLTextAreaElement | null>(null)
  const form = useForm<QuestionInput>({ resolver: zodResolver(questionSchema), defaultValues: { question: '' } })
  const value = useWatch({ control: form.control, name: 'question' })
  const empty = value.trim() === ''
  const { ref: registerRef, ...field } = form.register('question')

  // Ô cao theo chữ: đo lại sau mỗi lần chữ đổi (kể cả lúc xoá sau khi gửi); `max-h` của ô chặn ở bốn dòng
  useLayoutEffect(() => {
    const element = box.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${element.scrollHeight}px`
  }, [value])

  const handleSubmit = form.handleSubmit(({ question }) => {
    if (pending) return
    onSend(question.replace(/\s+/g, ' '))
    form.reset({ question: '' })
  })

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Bộ gõ đang ghép chữ (IME) thì Enter là chọn chữ, không phải gửi
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return
    event.preventDefault()
    void handleSubmit()
  }

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-none flex-col gap-2 border-t border-line-soft bg-bg px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <div
        className={cn(
          'flex items-end gap-2 rounded-lg border border-line-strong bg-bg py-1.5 pr-1.5 pl-3.5',
          'transition-[border-color,box-shadow] duration-(--dur-fast) ease-standard',
          'focus-within:border-cyan-500 focus-within:shadow-[0_0_0_1px_var(--cyan-500)]',
        )}
      >
        <label htmlFor={inputId} className="sr-only">{t('assistant.panel.inputLabel')}</label>
        <textarea
          id={inputId}
          rows={1}
          autoComplete="off"
          enterKeyHint="send"
          maxLength={QUESTION_MAX}
          placeholder={t('assistant.panel.placeholder')}
          onKeyDown={handleKeyDown}
          className={cn(
            'max-h-28 min-w-0 flex-1 resize-none self-center bg-transparent py-1.5 text-body leading-6 text-text outline-none placeholder:text-ink-3',
            CHAT_TOUCH,
          )}
          {...field}
          ref={(element) => {
            registerRef(element)
            box.current = element
          }}
        />
        <Button
          type="submit"
          variant="primary"
          size="icon"
          disabled={empty || pending}
          aria-label={t('assistant.panel.send')}
          className="pointer-coarse:size-12 in-[.assistant-touch]:size-14"
        >
          <ArrowUp aria-hidden />
        </Button>
      </div>
      {children}
    </form>
  )
}
