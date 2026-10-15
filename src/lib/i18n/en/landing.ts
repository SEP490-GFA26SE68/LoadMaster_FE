import type { Dictionary } from '../types'
import type { landing as source } from '../vi/landing'

export const landing = {
  skipToContent: 'Skip to main content',
  header: {
    nav: 'Site sections',
    menu: 'Site menu',
    features: 'Features',
    how: 'How it works',
    pricing: 'Pricing',
    contact: 'Contact',
    signIn: 'Sign in',
    openApp: 'Open the app',
    home: 'LoadMaster home',
  },
  hero: {
    eyebrow: '3D load planning for transport companies',
    title: 'Make the most of every truck, unload in the right order, follow it to the last stop.',
    lede: 'LoadMaster helps dispatchers build trips and optimize routes and 3D load plans. The warehouse loads and the driver unloads from the same approved plan.',
    cta: 'Talk to us',
    pricing: 'See pricing',
    artworkLabel: 'A truck body being loaded in unloading order',
  },
  features: {
    title: 'Key features',
    lede: 'One system for the whole trip: from receiving the packages to finishing the last stop.',
    loading: {
      title: '3D loading by delivery stop',
      text: 'Cargo for the last stop sits deepest and cargo for the first stop sits by the door: at each stop you take that stop’s cargo. View, rotate and adjust the plan in 3D.',
    },
    route: {
      title: 'Route optimization and monitoring',
      text: 'Optimize the order of stops, compare estimated arrival times with delivery deadlines, see the vehicle on the map and incidents on the road.',
    },
    roles: {
      title: 'The right screen for every role',
      text: 'The same plan goes through four roles, each working on their own device.',
    },
    roleList: {
      dispatcher: 'Builds trips, runs the optimization, compares and approves plans.',
      warehouse: 'Stages and loads each package on a tablet, checked by QR code.',
      driver: 'Delivers stop by stop on a phone and sees where the cargo sits in the truck.',
      manager: 'Creates delivery requirements, follows the dashboard and exports reports.',
    },
  },
  how: {
    title: 'How it works',
    lede: 'The four steps of a trip in LoadMaster.',
    step: 'Step {number}',
    steps: {
      intake: {
        title: 'Packages and delivery requirements',
        text: 'Import packages from a file or add them by hand and print QR labels. The manager creates delivery requirements with a destination and a deadline.',
      },
      plan: {
        title: 'Build the trip, optimize the route',
        text: 'The dispatcher adds requirements to a trip, picks a vehicle and optimizes the order of stops.',
      },
      optimize: {
        title: 'Load in 3D, compare, approve',
        text: 'One run gives three plans for three goals. Compare them, adjust by hand if needed, then approve.',
      },
      operate: {
        title: 'Stage, load, deliver, monitor',
        text: 'The warehouse checks each package while staging and loading, the driver delivers stop by stop, the dispatcher monitors vehicles and handles incidents.',
      },
    },
  },
  contact: {
    title: 'Contact LoadMaster',
    lede: 'Leave your details and the LoadMaster team will get back to you about the plan and setup that fit your fleet.',
    signUpNote: 'Company accounts are created by the LoadMaster team after talking with you.',
    loading: 'Loading the contact form',
    form: {
      fullName: 'Full name',
      email: 'Email',
      emailPlaceholder: 'name@company.com',
      phone: 'Phone number',
      company: 'Company name',
      type: 'What do you need',
      plan: 'Plan of interest',
      noPlan: 'No plan chosen',
      message: 'Message',
      messagePlaceholder: 'Number of vehicles, usual routes, what you would like to know.',
      submit: 'Send request',
      errors: {
        fullNameRequired: 'Enter your full name',
        fullNameTooLong: 'The name can be at most {max} characters',
        emailRequired: 'Enter your email',
        emailInvalid: 'This email is not valid',
        emailTooLong: 'The email can be at most {max} characters',
        phoneTooLong: 'The phone number can be at most {max} characters',
        companyTooLong: 'The company name can be at most {max} characters',
        messageTooLong: 'The message can be at most {max} characters',
      },
    },
    sent: {
      title: 'Request {id} received',
      text: 'The LoadMaster team will get back to you at the email you entered.',
      again: 'Send another request',
    },
  },
  footer: {
    nav: 'Footer links',
    landing: 'About',
    pricing: 'Pricing',
    contact: 'Contact',
    signIn: 'Sign in',
  },
} satisfies Dictionary<typeof source>
