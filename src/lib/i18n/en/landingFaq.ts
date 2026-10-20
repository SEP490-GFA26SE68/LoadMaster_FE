import type { Dictionary } from '../types'
import type { landingFaq as source } from '../vi/landingFaq'

export const landingFaq = {
  title: 'Frequently asked questions',
  lede: 'Short answers to what is worth knowing before you ask for advice.',
  more: 'Your question is not here?',
  contact: 'Ask the LoadMaster team',
  items: {
    whatIs: {
      q: 'What is LoadMaster?',
      a: 'LoadMaster is a 3D load planning and optimization system for small and medium transport companies. Dispatchers build trips and optimize routes and load plans; the warehouse loads and drivers unload following the same approved plan.',
    },
    start: {
      q: 'How do we start using LoadMaster?',
      a: 'LoadMaster has no self-service sign-up or trial yet. Send a contact request at the bottom of this page; the LoadMaster team advises on a plan, then opens an account for your company with a first company administrator who invites everyone else.',
    },
    devices: {
      q: 'Do we need to install anything?',
      a: 'No. LoadMaster is a web app that runs in the browser. Dispatchers work on a computer; warehouse staff use a tablet and drivers a phone, with large buttons and large text.',
    },
    roles: {
      q: 'Who in the company uses LoadMaster?',
      a: 'Company administrators manage accounts, the plan and credits; company managers create delivery requirements, follow the dashboard and export reports; dispatchers build trips, run optimizations and approve plans; warehouse staff stage and load cargo; drivers deliver stop by stop. Everyone sees only the work of their own role.',
    },
    import: {
      q: 'How do we get our package list in?',
      a: 'Import an .xlsx file from the template, one package per row: package code, length, width, height (cm), weight (kg), handling class, destination and, optionally, package type. Packages can also be added by hand. Every package gets a QR code for the label stuck on it.',
    },
    credit: {
      q: 'How are credits counted?',
      a: 'Each 3D load optimization run uses one credit and produces three plans to compare. Route optimization and finding an alternative route cost no credits. Monthly credits depend on the plan; the company administrator buys more when needed.',
    },
    axle: {
      q: 'How does LoadMaster compute axle loads?',
      a: 'With a lever model on the axle data entered for each truck: axle position, empty load and limit. A plan that overloads an axle cannot be approved. If a truck lacks axle data, the app shows no axle figures rather than guessing.',
    },
    data: {
      q: 'Can other companies see our data?',
      a: 'No. Data is separated by company: people in one company only see the trucks, packages, delivery requirements, trips and users of their own company.',
    },
    language: {
      q: 'Is the interface available in English?',
      a: 'Yes. The interface switches between Vietnamese and English at any time without losing what you are typing.',
    },
  },
} satisfies Dictionary<typeof source>
