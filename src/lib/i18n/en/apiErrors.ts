import type { Dictionary } from '../types'
import type { apiErrors as source } from '../vi/apiErrors'

export const apiErrors = {
  NETWORK_ERROR: 'Cannot reach the server. Check the network and try again.',
  TIMEOUT: 'The server took too long to respond. Try again later.',
  UNAUTHENTICATED: 'Your session has ended. Sign in again.',
  UNAUTHORIZED: 'You do not have permission to do this.',
  SERVER_ERROR: 'The server ran into an error. Try again later.',
  INVALID_INPUT: 'The server did not accept this action: the data is not valid, or you are acting on your own account.',
  VALIDATION_ERROR: 'Some data is not valid. Check the fields.',
  EMAIL_ALREADY_EXISTS: 'This email is already in use.',
  USER_ALREADY_EXISTS: 'This email is already in use.',
  USER_NOT_FOUND: 'This user was not found.',
  COMPANY_REQUIRED: 'Company roles need a company.',
  COMPANY_NOT_FOUND: 'The company was not found.',
  EMAIL_CHANGE_UNSUPPORTED: 'The server does not support changing an account email yet.',
  USER_COMPANY_NOT_FOUND: 'Your account does not belong to a company yet.',
} satisfies Dictionary<typeof source>
