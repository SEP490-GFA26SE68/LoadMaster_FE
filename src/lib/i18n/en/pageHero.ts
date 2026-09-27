import type { Dictionary } from '../types'
import type { pageHero as source } from '../vi/pageHero'

export const pageHero = {
  breadcrumb: 'Breadcrumb',
  trips: 'Trips in the period, plan status and what needs handling before handover to the warehouse.',
  tripForm: 'Enter trip details, pick a vehicle and order the delivery stops.',
  optimization: 'Set loading requirements and check the input before running the optimization.',
  fleet: 'Fleet status and which trip each vehicle is serving.',
  dashboard: 'Trips, fill rate and delivered weight for the period in view.',
  users: 'Accounts, roles and permissions in the system.',
  audit: 'Events recorded from actions that write data.',
  profile: 'Your personal details and sign-in password.',
} satisfies Dictionary<typeof source>
