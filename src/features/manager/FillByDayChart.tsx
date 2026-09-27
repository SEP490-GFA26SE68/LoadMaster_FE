import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Badge } from '@/components/ui/Badge'
import { useFormat, useT } from '@/lib/i18n'
import { ChartCard, ChartTable } from './ChartCard'
import { AXIS_LINE, BAR_FILL, ChartTooltip, GRID_STROKE, HOVER_CURSOR, INITIAL_SIZE, MONO_TICK } from './chart-style'
import type { DashboardSummary } from './dashboard-summary'

const PERCENT_TICKS = [0, 25, 50, 75, 100]

/**
 * Lấp đầy thể tích theo ngày chạy: mỗi ngày của kỳ một cột, ngày không có bản đã duyệt để trống (không nối, không bịa 0).
 * Kết quả mock mang nhãn MOCK RESULT như ở mọi nơi hiện số của kết quả tối ưu.
 */
export function FillByDayChart({ days, isMockResult, className }: {
  days: DashboardSummary['fillByDay']
  isMockResult: boolean
  className?: string
}) {
  const t = useT()
  const format = useFormat()
  const title = t('manager.charts.fill.title')
  const withData = days.flatMap((day) => (day.averagePercent === null ? [] : [{ ...day, averagePercent: day.averagePercent }]))

  return (
    <ChartCard
      className={className}
      title={title}
      note={t('manager.charts.fill.note')}
      badge={isMockResult ? <Badge shape="tag" tone="mock">MOCK RESULT</Badge> : null}
      empty={withData.length === 0 ? t('manager.charts.fill.empty') : undefined}
      table={
        <ChartTable
          title={title}
          headers={[t('manager.charts.fill.day'), t('manager.charts.fill.value'), t('manager.charts.fill.plans')]}
          rows={withData.map((day) => [format.date(day.date), format.percent(day.averagePercent), format.integer(day.planCount)])}
        />
      }
    >
      <ResponsiveContainer width="100%" height="100%" minHeight={240} initialDimension={INITIAL_SIZE}>
        <BarChart data={[...days]} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} accessibilityLayer={false}>
          <CartesianGrid vertical={false} stroke={GRID_STROKE} />
          <XAxis
            dataKey="date"
            tickFormatter={(date: string) => format.dayMonth(date)}
            tick={MONO_TICK}
            tickLine={false}
            axisLine={AXIS_LINE}
            minTickGap={12}
          />
          <YAxis
            domain={[0, 100]}
            ticks={PERCENT_TICKS}
            tickFormatter={(value: number) => t('manager.charts.percentTick', { value: format.integer(value) })}
            tick={MONO_TICK}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <Tooltip
            cursor={HOVER_CURSOR}
            isAnimationActive={false}
            content={<ChartTooltip formatLabel={(date) => format.date(date)} formatValue={(value) => format.percent(value)} />}
          />
          <Bar dataKey="averagePercent" fill={BAR_FILL} maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  )
}
