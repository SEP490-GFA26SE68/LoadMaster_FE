import type { Dictionary } from '../types'
import type { tripReport as source } from '../vi/tripReport'

export const tripReport = {
  title: 'Trip report',
  summary: '{delivered} / {planned} packages delivered · {issues} issues',
  notCompleted: 'The trip is not complete yet; the full report is ready after the last stop.',
} satisfies Dictionary<typeof source>
