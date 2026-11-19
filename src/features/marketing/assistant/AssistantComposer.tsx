import { zodResolver } from '@hookform/resolvers/zod'
import { SendHorizontal } from 'lucide-react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { fieldBoxClass, focusClass } from '@/components/ui/field-styles'
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
 * Ô gõ câu hỏi: nhãn thật (chỉ cho trình đọc màn hình), Enter là gửi, nút gửi là nút icon nhỏ — nút chính của trang vẫn là của trang. Ô
 * trống thì nút gửi mờ; đang chờ câu trả lời thì vẫn gõ được nhưng chưa gửi.
 */
export function AssistantComposer({ onSend, pending }: { onSend: (question: string) => void; pending: boolean }) {
  const t = useT()
  const inputId = ASSISTANT_INPUT_ID
  const form = useForm<QuestionInput>({ resolver: zodResolver(questionSchema), defaultValues: { question: '' } })
  const empty = useWatch({ control: form.control, name: 'question' }).trim() === ''

  const handleSubmit = form.handleSubmit(({ question }) => {
    if (pending) return
    onSend(question)
    form.reset({ question: '' })
  })

  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-none items-center gap-2 border-t border-line-soft bg-bg px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
    >
      <label htmlFor={inputId} className="sr-only">{t('assistant.panel.inputLabel')}</label>
      <input
        id={inputId}
        type="text"
        autoComplete="off"
        enterKeyHint="send"
        maxLength={QUESTION_MAX}
        placeholder={t('assistant.panel.placeholder')}
        className={cn(fieldBoxClass(false), focusClass, 'h-10 min-w-0 flex-1 px-3 placeholder:text-ink-3 pointer-coarse:h-12', CHAT_TOUCH)}
        {...form.register('question')}
      />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={empty || pending}
        aria-label={t('assistant.panel.send')}
        className="size-10 text-primary hover:text-primary-hover pointer-coarse:size-12"
      >
        <SendHorizontal aria-hidden />
      </Button>
    </form>
  )
}
