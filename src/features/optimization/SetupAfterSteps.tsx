import { useT } from '@/lib/i18n'

const STEPS = ['view', 'check', 'approve'] as const

/**
 * "Sau khi chạy" ở cuối cột phải Thiết lập tối ưu (V2.3): ba bước đánh số, chữ trần trên nền trang (không phải card). Bước cuối là quản lý
 * công ty duyệt (LM-104), không phải điều phối.
 */
export function SetupAfterSteps() {
  const t = useT()
  return (
    <section aria-labelledby="setup-after" className="px-1 pt-1">
      <h2 id="setup-after" className="text-small font-semibold text-ink-2">{t('optimization.afterTitle')}</h2>
      <ol className="m-0 mt-2.5 flex list-none flex-col gap-2 p-0">
        {STEPS.map((step, index) => (
          <li key={step} className="flex items-center gap-2.5 text-lede text-ink-2">
            <span aria-hidden className="grid size-5.5 flex-none place-items-center rounded-[7px] bg-n-100 font-display text-caption font-bold text-ink-2">
              {index + 1}
            </span>
            {t(`optimization.afterSteps.${step}`)}
          </li>
        ))}
      </ol>
    </section>
  )
}
