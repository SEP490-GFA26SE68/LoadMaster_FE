import type { Dictionary } from '../types'
import type { legal as source } from '../vi/legal'

export const legal = {
  title: 'Privacy policy',
  lede: 'What LoadMaster collects when you send a contact request, what it is used for, where it is kept and what you can ask us to do with it.',
  draft: 'Draft â awaiting legal review',
  draftNote: 'This page describes how the current web app handles your details, but it has not been reviewed by the legal team yet. It may change before the service goes live.',
  toc: 'Contents',
  collect: {
    title: 'What we collect',
    intro: 'The contact form on the landing page asks for:',
    required: 'required',
    optional: 'optional',
    system: 'The system also records when you sent it, its handling status, who at LoadMaster took it on and their internal notes.',
    consent: 'You tick the consent box before sending; without it the form sends nothing.',
  },
  purpose: {
    title: 'What it is used for',
    consult: 'Getting back to you about plans, a quote, a demo or a contract â whichever you chose in â{type}â.',
    account: 'Opening a company account once both sides agree to use LoadMaster.',
    never: 'The website does not pass these details to any advertising service or visitor analytics tool.',
  },
  storage: {
    title: 'Where it is kept',
    demo: 'In the demo, your request lives only in the memory of the browser you are using: the open tabs of the site share it, and it is gone once you close or reload every tab. Nothing is sent to a server.',
    server: 'Once the service runs in production, requests are sent to LoadMasterâs server and kept there.',
    nowDemo: 'The page you have open is the demo: requests sent from here stay in this browser.',
    nowServer: 'The page you have open sends requests to LoadMasterâs server.',
  },
  access: {
    title: 'Who can see it',
    intro: 'Only LoadMaster staff in these three roles, to handle your request:',
    companies: 'Companies using LoadMaster cannot see guest contact requests.',
  },
  retention: {
    title: 'How long we keep it',
    text: 'Until your request has been handled, or until you ask us to delete it. A concrete retention period will be written here once the legal team settles it.',
  },
  rights: {
    title: 'Your rights',
    view: 'See the details LoadMaster holds about you.',
    edit: 'Correct details that are wrong or out of date.',
    delete: 'Delete your request and your contact details.',
    how: 'Email the support inbox and mention the email address you used in the form:',
  },
  browser: {
    title: 'Browser storage and cookies',
    session: 'The app uses the browser tabâs sessionStorage to remember your language and your sign-in; closing the tab clears it.',
    none: 'The website uses no advertising cookies, no visitor analytics, and does not keep what you type in the browserâs long-term storage.',
    signIn: 'When you sign in through LoadMasterâs sign-in server, the sign-in library briefly keeps a check code in browser storage while the page redirects and then removes it; the sign-in server sets its own session cookie.',
    fonts: 'The site loads its fonts from Google Fonts, so your browser sends your IP address to Google’s servers when it fetches them.',
  },
  contact: {
    title: 'Contact',
    intro: 'Questions about this policy or about your details go to:',
    email: 'Email',
    phone: 'Phone',
    address: 'Address',
    taxCode: 'Tax code',
  },
  back: 'Back to the landing page',
} satisfies Dictionary<typeof source>
