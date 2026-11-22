import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm, type UseFormReturn } from 'react-hook-form'
import { z } from 'zod'
import type { Locale } from '@/lib/i18n'
import { assistantSession } from '../assistant/assistant-session'
import { extractTry, TRY_EXTRACT_AVAILABLE } from './try-extract-api'
import { extractGaps, extractValues, gapPaths, TRY_DESCRIBE_MAX } from './try-extract-values'
import type { TryFormValues } from './try-form'

/** Ô mô tả chỉ có khi trợ lý AI chạy trên máy chủ (nhóm `assistant`); kho mẫu, CI và E2E không có ô này. */
export const TRY_DESCRIBE_AVAILABLE = TRY_EXTRACT_AVAILABLE

const describeSchema = z.object({ text: z.string().trim().min(1).max(TRY_DESCRIBE_MAX) })
export type TryDescribeValues = z.input<typeof describeSchema>

type ExtractVariables = { readonly text: string; readonly locale: Locale }

/**
 * Một lượt "Điền giúp tôi" (`useMutation`, không khoá Query: kết quả không lưu ở cache). Máy chủ đọc ra số thì giá trị mới thay cả form
 * (`form.reset` — đúng kiểu chữ của form; xe `null` giữ thùng xe đang có), rồi các ô còn thiếu được kiểm ngay để lỗi hiện tại chỗ. Không
 * nhận ra kiện nào hay lỗi thì form giữ nguyên. Bộ tối ưu không chạy: khách tự bấm "Tính ba phương án". Việc điền nằm ở `onSuccess` của
 * chính mutation, nên khách đổi sang tab "Tải trục" giữa lúc chờ thì form vẫn được điền.
 */
export function useTryExtract(form: UseFormReturn<TryFormValues>) {
  return useMutation({
    mutationFn: ({ text, locale }: ExtractVariables) => extractTry({ text, locale, guestKey: assistantSession.guestKey() }),
    onSuccess: (result, { locale }) => {
      const values = extractValues(result, form.getValues(), locale)
      if (values === null) return
      form.reset(values)
      const paths = gapPaths(extractGaps(result), values.cartons.length)
      if (paths.length > 0) void form.trigger(paths)
    },
  })
}

/**
 * Ô mô tả và lượt điền của nó, giữ ở cấp phần "Thử với hàng của bạn" (như form số): đổi tab rồi quay lại, mô tả đang gõ và câu "đã điền gì"
 * vẫn còn.
 */
export function useTryDescribe(form: UseFormReturn<TryFormValues>) {
  const text = useForm<TryDescribeValues>({ resolver: zodResolver(describeSchema), defaultValues: { text: '' } })
  const extract = useTryExtract(form)
  return { text, extract }
}

export type TryDescribeState = ReturnType<typeof useTryDescribe>
