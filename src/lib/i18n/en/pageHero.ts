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
  packageTypes: 'Size, weight and stacking templates set on pool packages.',
  packages: 'Your company packages: add one by one or import a file, print QR labels, follow status until delivery.',
  labels: 'QR labels of pool packages, printed to stick on each package.',
  lookup: 'Scan or type a code to see the status and trip of a package, and reprint its label.',
  requirements: 'What has to be delivered: packages from the pool to one destination before a deadline, waiting for the dispatcher to put them on a trip.',
  vehicleTypes: 'Cargo dimensions and payload by vehicle type.',
  tripReport: 'Packages delivered, issues, and loading and delivery times of the trip.',
} satisfies Dictionary<typeof source>
