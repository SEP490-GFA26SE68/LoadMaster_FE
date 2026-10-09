import { ChevronRight, OctagonAlert } from 'lucide-react'
import { useT } from '@/lib/i18n'
import type { FormIssue } from './vehicle-form-resolver'

/** Phần của form chứa ô lỗi (khớp số ở `VehicleFormSection`): vật cản là phần 2, trục là phần 3, còn lại là phần 1. */
export function sectionOfIssue(path: string): 1 | 2 | 3 {
  if (path.startsWith('obstacles')) return 2
  if (path.startsWith('axles')) return 3
  return 1
}

/**
 * Tóm tắt lỗi ở đầu form xe (LM-041, V2.3): danh sách đánh số, mỗi dòng nói lỗi và phần của form nó thuộc về. Câu đã được resolver
 * dịch sẵn: lỗi từng ô do schema form, lỗi Spec nhiều trường do `validateVehicle` qua `formatIssue`. Bấm một dòng thì nhảy tới ô
 * tương ứng.
 */
export function VehicleValidationSummary({
  issues,
  onFocus,
}: {
  issues: readonly FormIssue[]
  onFocus: (path: string) => void
}) {
  const t = useT()
  if (issues.length === 0) return null

  return (
    <section
      aria-labelledby="loi-cau-hinh-xe"
      className="flex flex-col gap-2.5 rounded-lg border border-badge-danger-border bg-badge-danger-bg px-4 py-3.5"
    >
      <h2 id="loi-cau-hinh-xe" className="flex items-center gap-2 text-body font-semibold text-danger">
        <OctagonAlert className="size-5 shrink-0" strokeWidth={1.5} aria-hidden />
        {t('fleet.validation.title', { count: issues.length })}
      </h2>
      <ol className="flex flex-col">
        {issues.map((issue, index) => (
          <li key={`${issue.path}:${issue.message}`} className="border-t border-badge-danger-border first:border-t-0">
            <button
              type="button"
              onClick={() => onFocus(issue.path)}
              className="flex w-full items-center gap-3 rounded-sm px-1 py-2 text-left text-body text-ink-1 transition-colors duration-(--dur-fast) ease-standard hover:bg-bg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              <span aria-hidden className="grid size-5 flex-none place-items-center rounded-sm bg-bg font-mono text-caption text-ink-2">{index + 1}</span>
              <span className="min-w-0 flex-1">{issue.message}</span>
              <span className="flex flex-none items-center gap-0.5 text-small font-medium text-danger">
                {t('fleet.validation.section', { number: sectionOfIssue(issue.path) })}
                <ChevronRight aria-hidden className="size-4" strokeWidth={1.5} />
              </span>
            </button>
          </li>
        ))}
      </ol>
      <p className="text-small text-ink-3">{t('fleet.validation.focusHint')}</p>
    </section>
  )
}
