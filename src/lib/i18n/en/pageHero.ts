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
  packageTypes: 'Size, weight and stacking templates used to register packages.',
  packages: 'Packages your company registered, their QR codes and status until delivery.',
  labels: 'QR labels of registered packages, printed to stick on each package.',
  shipments: 'Registered packages grouped and handed over to a logistics company.',
  shipment: 'Packages in the shipment and how many the logistics company has scanned in.',
  receiving: 'Scan each package’s QR code to confirm the shipment was received.',
  orders: 'Transport orders built from received packages, assigned to trip stops.',
  review: 'Optimized plans waiting for the manager to approve, reject or send back.',
  vehicleTypes: 'Cargo dimensions and payload by vehicle type.',
  tripReport: 'Packages delivered, issues, and loading and delivery times of the trip.',
} satisfies Dictionary<typeof source>
