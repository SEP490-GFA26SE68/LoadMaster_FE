/**
 * Backend capabilities verified against the merged Dispatcher endpoints.
 * CREATE remains explicit; manage/unassign preserve the newly integrated CRUD.
 */
export const REQUIREMENT_SERVER_SUPPORT = {
  create: true,
  manage: true,
  unassign: true,
} as const
