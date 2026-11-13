/**
 * Backend capabilities are independent: verified POST create is available to
 * Dispatcher; editing/deleting/scheduling/extending remain disabled in this task.
 * Assignment and missing-coordinate updates retain their existing behavior.
 */
export const REQUIREMENT_SERVER_SUPPORT = {
  create: true,
  manage: false,
  unassign: false,
} as const
