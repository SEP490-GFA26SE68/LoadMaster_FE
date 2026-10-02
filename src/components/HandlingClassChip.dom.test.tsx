import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { HANDLING_CLASSES } from '@/domain/models'
import { I18nProvider } from '@/lib/i18n'
import { HandlingClassChip } from './HandlingClassChip'

/** Chip loại hàng (FE-3b-04): năm loại, nhãn lấy từ nhánh `common`, màu là tint theo nghĩa — không phải màu điểm giao. */
test('each of the five handling classes shows its Vietnamese label on a fixed-meaning tint', () => {
  render(
    <I18nProvider>
      {HANDLING_CLASSES.map((handlingClass) => <HandlingClassChip key={handlingClass} handlingClass={handlingClass} />)}
    </I18nProvider>,
  )
  const tintOf = (label: string) => [...screen.getByText(label).classList].filter((name) => name.startsWith('bg-') || name.startsWith('text-tint'))
  // Hàng thường là ngữ cảnh (slate); bốn loại cần chú ý khi xếp là hổ phách
  expect(tintOf('Thường')).toStrictEqual(['bg-tint-slate', 'text-tint-slate-fg'])
  for (const label of ['Dễ vỡ', 'Hàng lạnh', 'Nguy hiểm', 'Giá trị cao']) {
    expect(tintOf(label)).toStrictEqual(['bg-tint-amber', 'text-tint-amber-fg'])
  }
  expect(document.body.innerHTML).not.toMatch(/stop-\d|violet|purple/)
})
