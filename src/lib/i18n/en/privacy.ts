import type { Dictionary } from '../types'
import type { privacy as source } from '../vi/privacy'

export const privacy = {
  title: 'Privacy policy',
  lede: 'What data LoadMaster collects, where it sends it and where it keeps it — exactly as in the version of the app you have open.',
  updated: 'Last updated: {date}',
  contact: {
    title: 'Contact form',
    intro: 'The contact form on the About page sends only these fields:',
    required: '{field} (required)',
    optional: '{field} (if you fill it in)',
    consent: 'The tick that you agree to this policy only enables the send button; the form does not send it. The form also has a hidden field that spots automated senders — that field is not sent either.',
    record: 'The system also records when you sent it; while handling it, the LoadMaster team records the status, the assignee and an internal note.',
    handlers: 'Only {roles} on the LoadMaster team read and handle contact requests.',
    server: 'Your request is sent to the LoadMaster server.',
    demo: 'This demo is not connected to a server: your request stays only in this browser’s memory (shared by its open tabs) and is lost when every tab is closed or reloaded.',
  },
  registration: {
    title: 'Trial and paid sign-up',
    trial: 'Trial sign-up sends to the LoadMaster server: company name, tax code, full name, email, phone number and — if you fill them in — company address and a note. The server emails a confirmation code to that address, runs a first check, and then the LoadMaster team reviews the request.',
    paid: 'Paid sign-up sends company name, company code, tax code, full name, email, phone number and — if you fill it in — company address; after the email confirmation code come the plan and billing cycle you choose.',
    payment: 'The payment step is currently simulated: the app has no field for a card number or bank account.',
    off: 'This version has no public sign-up: company accounts are created by the LoadMaster team after a contact request.',
  },
  app: {
    title: 'When you use the app',
    signIn: 'You sign in with your email and password; the app sends them straight to Keycloak — LoadMaster’s sign-in server — and does not store the password. The sign-in token lives only in the tab’s memory; the refresh token is kept in the tab’s sessionStorage so reloading the page does not sign you out.',
    signInPage: 'When the sign-in server does not allow signing in on the app’s own screen, the app takes you to Keycloak’s sign-in page; that page uses Keycloak’s own cookies.',
    signInDemo: 'This demo signs in with sample accounts inside the browser; the session is kept in the tab’s sessionStorage.',
    tenancy: 'Every account belongs to one company and can only read that company’s vehicles, packages, trips and users.',
    maps: 'Maps appear only inside the app, not on the public pages. When the installation has a map key, the browser loads map tiles from Goong, the map provider; without a key nothing is loaded. The address search box never calls Goong from the browser: when connected to a server, searches go through the LoadMaster server.',
    gps: 'A driver’s phone location is sent only while the driver has “Use real GPS” on during a running trip, and stops when the driver turns it off or leaves the trip screen.',
  },
  browser: {
    title: 'In your browser',
    storage: 'LoadMaster uses only the sessionStorage of the open tab — cleared by the browser when the tab closes — to remember the language, the sign-in session and a few temporary screen states. The app does not use localStorage, and the app’s code sets no cookies.',
    tracking: 'LoadMaster adds no analytics, advertising or visitor-tracking tools.',
    assistant: '{name} answers right in the browser from prepared material: what you type is not sent anywhere and is gone when you reload — unless you move your questions into the contact form and send it yourself.',
    fonts: 'LoadMaster loads two fonts from Google Fonts, so the browser sends a request to Google’s servers.',
  },
  questions: {
    title: 'Questions about your data',
    body: 'To ask about data you have sent, send a request through the contact form.',
    action: 'Open the contact form',
    email: 'Or write to {email}.',
  },
} satisfies Dictionary<typeof source>
