import { useId } from 'react'
import { Card, CardHeader, CardMeta, CardTitle } from '@/components/ui/Card'
import { useFormat, useT } from '@/lib/i18n'
import type { CompanyChatEntry } from './support-chat'

/** Trao đổi gần đây của công ty đang chọn ở `/ho-tro`: mọi lần trả lời trong các yêu cầu của công ty, hai ngày có hoạt động gần nhất. */
export function CompanyChatCard({ entries }: { entries: readonly CompanyChatEntry[] }) {
  const t = useT()
  const format = useFormat()
  const titleId = useId()
  return (
    <Card role="region" aria-labelledby={titleId}>
      <CardHeader>
        <CardTitle as="h2" id={titleId}>{t('support.page.chat.title')}</CardTitle>
        <CardMeta>{t('support.page.chat.hint')}</CardMeta>
      </CardHeader>
      <ul className="m-0 flex max-h-64 list-none flex-col gap-2 overflow-y-auto p-4.5 pt-0">
        {entries.map((entry, index) => (
          <li key={`${entry.ticketId}-${entry.at}-${index}`} className="rounded-md border border-line-soft bg-surface px-3 py-2">
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-fine text-ink-3">
              <span className="font-medium text-ink-1">{entry.authorName} · <span className="font-mono">{entry.ticketLabel}</span></span>
              <time dateTime={entry.at} className="tabular-nums">{format.date(entry.at)} {format.time(entry.at)}</time>
            </div>
            <p className="m-0 text-small break-words whitespace-pre-wrap text-ink-1">{entry.text}</p>
          </li>
        ))}
      </ul>
    </Card>
  )
}
