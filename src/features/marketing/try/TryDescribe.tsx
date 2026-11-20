import { Sparkles, WandSparkles } from 'lucide-react'
import { useId } from 'react'
import { useWatch } from 'react-hook-form'
import { Banner } from '@/components/Banner'
import { Button } from '@/components/ui/Button'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/Textarea'
import { useLocale, useT } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { PUBLIC_TOUCH } from '../public-chrome'
import { extractErrorMessage, extractSummary, gapLabel } from './try-extract-text'
import { extractGaps, TRY_DESCRIBE_MAX, type TryExtract } from './try-extract-values'
import { TRY_NOTE } from './TryNumberInput'
import type { TryDescribeState } from './useTryExtract'

type Extract = TryDescribeState['extract']

const LIST_TITLE = 'm-0 text-small font-semibold text-ink-2 pointer-coarse:text-body-lg'
const LIST = 'm-0 mt-1 flex list-disc flex-col gap-1 pl-5 text-small text-ink-2 pointer-coarse:text-body-lg'

/** Một danh sách có tiêu đề dưới ô: "Lumo đã giả định" (chữ của máy chủ, giữ nguyên) hay "Cần bạn nhập thêm" (nhãn ô của form). */
function NoteList({ title, items }: { title: string; items: readonly string[] }) {
  const id = useId()
  if (items.length === 0) return null
  return (
    <div>
      <p id={id} className={LIST_TITLE}>{title}</p>
      <ul aria-labelledby={id} className={LIST}>
        {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
      </ul>
    </div>
  )
}

function Lists({ result }: { result: TryExtract }) {
  const t = useT()
  const gaps = extractGaps(result)
  return (
    <>
      <NoteList title={t('landingTry.describe.assumptions')} items={result.assumptions} />
      <NoteList title={t('landingTry.describe.missing')} items={gaps.map((gap) => gapLabel(gap, t))} />
    </>
  )
}

/**
 * Dưới ô: vùng `status` nói đang đọc / đã điền gì (màn đã cho thấy kết quả nên không toast), hai danh sách, hoặc một dòng lỗi nói thẳng
 * chưa điền được — form giữ nguyên, khách nhập tay.
 */
function Outcome({ extract }: { extract: Extract }) {
  const t = useT()
  const result = extract.data
  const status = extract.isPending ? t('landingTry.describe.reading') : result ? extractSummary(result, t) : ''
  return (
    <>
      <p role="status" className={cn('m-0 text-small text-ink-2 empty:sr-only pointer-coarse:text-body-lg', result && 'font-medium')}>{status}</p>
      {extract.isError ? (
        <Banner tone="danger" role="alert" className="pointer-coarse:text-body-lg">{extractErrorMessage(extract.error, t)}</Banner>
      ) : null}
      {result && !extract.isPending ? <Lists result={result} /> : null}
    </>
  )
}

/**
 * "Mô tả hàng bằng lời" đầu tab xếp thử — chỉ khi trợ lý AI chạy trên máy chủ. Khách gõ mô tả (tối đa 1.000 ký tự, có bộ đếm), bấm
 * "Điền giúp tôi" (nút phụ: nút chính của trang ở phần mở đầu) và máy chủ đọc ra số để điền form bên dưới; khách kiểm lại rồi tự bấm
 * "Tính ba phương án". Một dòng nói mô tả đi tới máy chủ LoadMaster và Anthropic. Đang chờ: vòng quay thay icon, nút giữ nguyên chỗ,
 * bấm thêm không gửi lần nữa. Là một `<form>` riêng, đứng trước — không lồng trong — form số.
 */
export function TryDescribe({ describe }: { describe: TryDescribeState }) {
  const t = useT()
  const { locale } = useLocale()
  const { text: form, extract } = describe
  const id = useId()
  const value = useWatch({ control: form.control, name: 'text' })
  const pending = extract.isPending

  const handleSubmit = form.handleSubmit(({ text }) => {
    if (!pending) extract.mutate({ text, locale })
  })

  return (
    <form noValidate onSubmit={handleSubmit} className="relative flex flex-col gap-3 border-b border-line-soft pb-5">
      <Textarea
        id={id}
        label={t('landingTry.describe.label')}
        hint={t('landingTry.describe.hint')}
        rows={3}
        maxLength={TRY_DESCRIBE_MAX}
        aria-describedby={`${id}-mo-ta ${id}-dem ${id}-cong-bo`}
        className="pointer-coarse:text-body-lg"
        {...form.register('text')}
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <Button
          type="submit"
          variant="secondary"
          disabled={value.trim() === ''}
          aria-busy={pending || undefined}
          className={cn('self-start', PUBLIC_TOUCH)}
        >
          {pending ? (
            // Vùng `status` dưới ô đã đọc "đang đọc mô tả": vòng quay chỉ là hình
            <span aria-hidden className="contents"><Spinner /></span>
          ) : (
            <WandSparkles aria-hidden strokeWidth={1.5} />
          )}
          {t('landingTry.describe.submit')}
        </Button>
        <p id={`${id}-dem`} className={cn(TRY_NOTE, 'tabular-nums')}>
          {t('landingTry.describe.count', { count: value.length, max: TRY_DESCRIBE_MAX })}
        </p>
      </div>
      <p id={`${id}-cong-bo`} className={cn(TRY_NOTE, 'flex items-start gap-2')}>
        <Sparkles aria-hidden strokeWidth={1.5} className="mt-0.5 size-4 flex-none text-primary" />
        {t('landingTry.describe.disclosure')}
      </p>
      <Outcome extract={extract} />
    </form>
  )
}
