import { Fragment } from 'react'
import { useFormat, useT } from '@/lib/i18n'
import { stopForeground } from '@/lib/stops'
import { readToken } from '@/lib/tokens'
import { cn } from '@/lib/utils'
import { contrastRatio } from '../contrast'
import { SheetCard } from '../SheetLayout'

type Token = `--${string}`
/** Token (`--primary`) đọc từ CSS lúc chạy, hoặc màu `lib/stops` đang dùng thật (chữ trên mốc điểm giao không phải token). */
type Pair = { fg: string; bg: Token }

type RowKey =
  | 'onPrimary' | 'link' | 'textSecondary' | 'badgeCyan' | 'badgeWarning' | 'badgeAzure' | 'badgeSuccess'
  | 'skyText' | 'onDanger' | 'control' | 'fieldBorder' | 'stops' | 'forbidden'

const stopPair = (number: number): Pair => ({ fg: stopForeground(number), bg: `--stop-${number}` })

/**
 * Cặp màu được kiểm, ngưỡng WCAG của từng cặp: 4,5 cho chữ thường, 3 cho viền và điều khiển (1.4.11). Dòng cuối là cặp cấm — hiện
 * để thấy vì sao nút chính dùng chữ tối. Đáy dải trời (`--sky-end`) là phần sáng nhất nên là trường hợp xấu nhất cho chữ trên dải.
 */
const ROWS: readonly { key: RowKey; pairs: readonly Pair[]; min: number }[] = [
  { key: 'onPrimary', pairs: [{ fg: '--on-primary', bg: '--primary-fill-to' }], min: 4.5 },
  { key: 'link', pairs: [{ fg: '--primary', bg: '--bg' }], min: 4.5 },
  { key: 'textSecondary', pairs: [{ fg: '--text-3', bg: '--bg' }], min: 4.5 },
  { key: 'badgeCyan', pairs: [{ fg: '--badge-cyan-fg', bg: '--badge-cyan-bg' }], min: 4.5 },
  { key: 'badgeWarning', pairs: [{ fg: '--badge-warning-fg', bg: '--badge-warning-bg' }], min: 4.5 },
  { key: 'badgeAzure', pairs: [{ fg: '--badge-azure-fg', bg: '--badge-azure-bg' }], min: 4.5 },
  { key: 'badgeSuccess', pairs: [{ fg: '--badge-success-fg', bg: '--badge-success-bg' }], min: 4.5 },
  { key: 'skyText', pairs: [{ fg: '--cyan-200', bg: '--sky-end' }], min: 4.5 },
  { key: 'onDanger', pairs: [{ fg: '--bg', bg: '--danger' }], min: 4.5 },
  { key: 'control', pairs: [{ fg: '--primary', bg: '--bg' }], min: 3 },
  { key: 'fieldBorder', pairs: [{ fg: '--line-strong', bg: '--bg' }], min: 3 },
  { key: 'stops', pairs: [stopPair(3), stopPair(6), stopPair(7)], min: 4.5 },
  { key: 'forbidden', pairs: [{ fg: '--bg', bg: '--primary-fill-to' }], min: 4.5 },
]

function isToken(color: string): color is Token {
  return color.startsWith('--')
}

function resolve(color: string): string {
  return isToken(color) ? readToken(color) : color
}

export function ContrastCard() {
  const t = useT()
  const format = useFormat()
  return (
    <SheetCard title={t('designSystem.style.contrast.title')} meta={t('designSystem.style.contrast.meta')} className="col-span-12 lg:col-span-6">
      <table className="w-full border-collapse text-small">
        <thead className="sr-only">
          <tr>
            <th scope="col">{t('designSystem.style.contrast.pair')}</th>
            <th scope="col">{t('designSystem.style.contrast.ratio')}</th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map(({ key, pairs, min }) => (
            <tr key={key}>
              <th scope="row" className={cn('py-1.25 pr-4 text-left font-normal', key === 'forbidden' ? 'text-ink-3' : 'text-ink-1')}>
                {t(`designSystem.style.contrast.rows.${key}`)}
              </th>
              <td className="py-1.25 text-right font-display font-[650] whitespace-nowrap tabular-nums">
                {pairs.map((pair, index) => {
                  const ratio = contrastRatio(resolve(pair.fg), resolve(pair.bg))
                  const pass = ratio !== null && ratio >= min
                  return (
                    <Fragment key={index}>
                      {index > 0 ? <span className="text-ink-3"> · </span> : null}
                      {ratio === null ? (
                        <span className="text-ink-3">{t('designSystem.style.unread')}</span>
                      ) : (
                        <span className={pass ? 'text-success' : 'text-danger'}>
                          {format.ratio(ratio)}
                          <span className="sr-only"> {t(pass ? 'designSystem.style.contrast.pass' : 'designSystem.style.contrast.fail')}</span>
                        </span>
                      )}
                    </Fragment>
                  )
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SheetCard>
  )
}
