import type { Dictionary } from '../types'
import type { notifications as source } from '../vi/notifications'

export const notifications = {
  label: 'Notifications',
  labelUnread: { one: 'Notifications, {count} unread', other: 'Notifications, {count} unread' },
  title: 'Notifications',
  unreadCount: { one: '{count} unread', other: '{count} unread' },
  markAllRead: 'Mark as read',
  unread: 'Unread',
  loading: 'Loading notifications…',
  error: 'Could not load notifications.',
  retry: 'Try again',
  empty: 'No notifications in the last {days} days.',
  scope: 'Events from the last {days} days, not including your own actions.',
  dateTime: '{time} · {date}',
  etaRisk: {
    AT_RISK: 'Trip {tripId}: stop {stop} is close to its deadline',
    MISSED: 'Trip {tripId}: stop {stop} is expected to miss its deadline',
    detail: 'Expected arrival {eta} · deadline {deadline}',
    moment: '{time} {date}',
  },
  exceptionEscalated: 'Trip {tripId}: incident ({type}) sent to the manager',
  driver: {
    loadingStarted: 'New trip: the warehouse is staging your cargo',
    loadingRestarted: 'The warehouse is staging your cargo again',
    loadingCompleted: 'Loaded — waiting for you to depart',
    replanDamaged: 'Trip on hold: the warehouse reported a damaged package, waiting for the dispatcher to re-plan',
    replanShortage: 'Trip on hold: a package is missing, waiting for the dispatcher to re-plan',
    cancelled: 'Trip cancelled',
    assigned: 'New trip: you now drive this trip',
    unassigned: 'You no longer drive this trip',
    pickupApproved: 'The dispatcher approved an en-route pickup — the route has a new pickup stop',
    pickupRejected: 'En-route pickup request rejected',
    stopsReordered: 'The dispatcher changed the stop order — check the route',
  },
} satisfies Dictionary<typeof source>
