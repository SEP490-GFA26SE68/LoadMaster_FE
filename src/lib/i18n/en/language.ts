import type { Dictionary } from '../types'
import type { language as source } from '../vi/language'

export const language = {
  label: 'Interface language',
  current: 'Interface language: {name}',
} satisfies Dictionary<typeof source>
