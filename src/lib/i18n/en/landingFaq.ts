import type { Dictionary } from '../types'
import type { landingFaq as source } from '../vi/landingFaq'

export const landingFaq = {
  title: 'FAQ',
  lede: 'Questions customers often ask before a trial. {name} in the corner of the screen gives the same answers — if yours is not here, ask {name} or send the contact form.',
} satisfies Dictionary<typeof source>
