import type { Dictionary } from '../types'
import type { auth as source } from '../vi/auth'

export const auth = {
  login: {
    title: 'Sign in',
    greeting: "Hi, I'm Lumo!",
    subtitle: '3D cargo load planning and optimization system.',
    email: 'Email',
    emailPlaceholder: 'name@loadmaster.vn',
    password: 'Password',
    submit: 'Sign in',
    emailRequired: 'Enter your email',
    emailInvalid: 'Enter a valid email address',
    passwordRequired: 'Enter your password',
    invalidCredentials: 'Incorrect email or password',
    accountSuspended: 'This account is locked. Contact your system administrator.',
    serverUnreachable: 'Cannot reach the server. Try again later.',
  },
  showcase: {
    tagline: 'Every truck carries more, and unloads in the right order.',
    fillRate: 'Fill each vehicle better and run fewer trips',
    reverseOrder: 'Load in reverse delivery order — each stop unloads only its own cargo',
    sharedPlan: 'The warehouse loads and drivers unload from the same approved 3D plan',
    artworkLabel: 'Animation of a truck body being loaded in unloading order',
  },
  demo: {
    title: 'Demo accounts',
    password: 'password {password}',
    platform: 'Platform',
  },
} satisfies Dictionary<typeof source>
