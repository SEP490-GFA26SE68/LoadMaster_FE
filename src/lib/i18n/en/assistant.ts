import type { Dictionary } from '../types'
import type { assistant as source } from '../vi/assistant'

export const assistant = {
  launcher: {
    label: 'Ask {name}',
    labelApp: 'AI assistant',
  },
  panel: {
    subtitle: 'Questions about LoadMaster',
    close: 'Close the assistant',
    restart: 'Start over',
    expand: 'Enlarge the chat',
    shrink: 'Shrink the chat',
    log: 'Conversation with {name}',
    disclaimer: '{name} answers from the LoadMaster documentation — not a sales or support person.',
    disclaimerAi: '{name} is an AI assistant that answers from the LoadMaster documentation and can be wrong — ask the LoadMaster team about anything important.',
    disclaimerAiApp: '{name} is an AI assistant that answers from the documentation and the data you can see, and can be wrong — check before acting on anything important.',
    introHintApp: 'Ask me about the screen you have open or the data you can see in LoadMaster.',
    appStarters: {
      page: 'What is this screen for?',
      trips: 'Which trips are in transit?',
      credit: 'How many credits does the company have left?',
      payroll: 'What does my pay slip look like this month?',
      tickets: 'Where are my support requests at?',
      plans: 'How do the plans differ?',
    },
    greeting: 'Hi, I’m {name}.',
    introHint: 'Ask me about plans, credits, how LoadMaster plans a load or how to try it.',
    starters: 'Suggested questions',
    followUps: 'Ask next',
    typing: '{name} is answering…',
    you: 'You asked',
    says: '{name} answered',
    error: 'Could not answer that one. Please try sending it again.',
    inputLabel: 'Your question',
    placeholder: 'Type a question…',
    send: 'Send question',
  },
  topics: {
    plans: {
      chip: 'What do the plans cost?',
      answer: 'Each plan is billed monthly and includes credits for 3D load optimization. These are the plans on sale:',
    },
    credit: {
      chip: 'How many credits does one optimization use?',
      answer: 'Optimizing the order of delivery stops uses no credits. Credits left at the end of a period do not carry over to the next one.',
    },
    advisor: {
      chip: 'Which plan fits my company?',
      answer: 'About how many load optimizations does your company run a month? Pick an amount or type a number to see the credits needed and the cheapest plan that covers them.',
    },
    start: {
      chip: 'How can I try it?',
      answer: 'Send a trial request through the contact form. The LoadMaster team creates your company account after receiving it.',
      answerSelf:
        'You can sign up for a Basic trial yourself: enter your company details, confirm the code sent by email, then the LoadMaster team reviews the request. To start right away, sign up for a paid plan. Trial accounts must sign the service agreement within 72 hours.',
    },
    howItWorks: {
      chip: 'How does LoadMaster work?',
      answer: 'A trip goes through five legs:',
    },
    roles: {
      chip: 'Who in my company uses LoadMaster?',
      answer: 'Each person uses LoadMaster in their own role, on the device that suits the job:',
    },
    devices: {
      chip: 'Does it work on phones?',
      answer:
        'Yes. Warehouse staff use it on tablets and drivers on phones, right in the browser: large buttons, large text, one task per screen. Drivers can also see where each package sits on the truck in 3D.',
    },
    packages: {
      chip: 'How do I enter packages?',
      answer:
        'Warehouse staff import packages from an Excel file based on a template, or add them one by one. Before saving, LoadMaster shows a preview and points out the rows with errors. Each package gets its own QR code to print as a label.',
    },
    verify: {
      chip: 'How do you make sure the right package is loaded and delivered?',
      answer:
        'At the warehouse and at delivery, each package is checked by scanning its QR code or typing the code printed on the label. If a label is damaged, staff confirm by hand with a reason, and a dispatcher approves it.',
    },
    loading3d: {
      chip: 'What does a 3D load plan show?',
      answer: 'You rotate the view to see each package in the cargo box, colored by delivery stop, and adjust by hand before approving.',
    },
    axle: {
      chip: 'Do you check axle loads?',
      answer:
        'Yes, once the vehicle has its axle positions and limits entered. LoadMaster estimates the front and rear axle loads of the plan and says clearly when a limit is exceeded. Without axle data there is no axle figure.',
    },
    routes: {
      chip: 'Does it optimize routes?',
      answer:
        'Yes. Dispatchers order the delivery stops with the route optimization button and see each stop’s estimated arrival against its deadline. While the truck is on the road, the monitoring screen shows it on a map, updates arrival times and warns about stops at risk of being late.',
    },
    tenancy: {
      chip: 'Is my company’s data kept separate?',
      answer:
        'Yes. A company account only sees its own company’s vehicles, packages, trips and users; the company admin creates accounts and assigns roles to staff. The LoadMaster team cannot open a company’s vehicles, packages or trips — it only sees accounts, plans, credit and support requests to help you.',
    },
    support: {
      chip: 'How do I get help once I’m using it?',
      answer: 'Company users open "Support requests" in the account menu and talk to the support team inside the app.',
    },
    human: {
      chip: 'I want to ask someone at LoadMaster',
      answer: 'Send your question through the contact form; the LoadMaster team reads it and replies by the email or phone number you leave.',
    },
    about: {
      chip: 'Who are you?',
      answer:
        'I am the LoadMaster mascot, answering from the product documentation — not a sales or support person. I forget everything when you reload the page. For anything unclear, send it to the LoadMaster team.',
    },
  },
  facts: {
    loadingPlans: 'Loading the plans…',
    planLine: '{name}: {price} a month, {credits}',
    unlimited: 'unlimited credits',
    objectives: {
      one: 'Each optimization run produces {count} plan to compare:',
      other: 'Each optimization run produces {count} plans to compare:',
    },
    restRule: 'Estimated arrivals include a mandatory {rest}-minute break after every {drive} hours of continuous driving.',
    roleLine: '{role}: {device}',
    devices: {
      desktop: 'computer',
      desktopTablet: 'computer or tablet',
      tablet: 'tablet at the warehouse',
      phone: 'phone',
    },
  },
  advisor: {
    quickLabel: 'Quick pick of runs per month',
    quick: { one: '{count} run a month', other: '{count} runs a month' },
    runsLabel: 'Runs per month',
    submit: 'Find a plan',
    invalid: 'Enter a whole number from 1 to {max}.',
    math: {
      one: '{count} run × {cost} credits per run = {credits} credits a month.',
      other: '{count} runs × {cost} credits per run = {credits} credits a month.',
    },
    pick: 'Cheapest plan that covers it: {name} — {price} a month, {credits}.',
    credits: '{count} credits a month',
    caveat: 'This is only an estimate based on the runs you entered.',
    none: 'No plan on sale covers {credits} credits a month yet.',
  },
  actions: {
    label: 'See more',
    plans: 'See the plans',
    pricing: 'Open pricing',
    how: 'See how it works',
    trial: 'Start a trial',
    registerNow: 'Sign up now',
    requestTrial: 'Request a trial',
  },
  ai: {
    links: 'Open a related screen',
    handoffQuestion: 'Pass the question to the support team?',
    handoffYes: 'Yes, pass it to support',
    handoffNo: 'No need',
    handoffYesMessage: 'Yes, pass it to the support team.',
    handoffNoMessage: 'No need to pass it on.',
    ticket: 'Support request {code} has been created. The support team replies under “Support requests” in the account menu.',
    degraded: 'The AI assistant is busy, so this is a prepared answer.',
  },
  fallback: 'I have no answer for that in the LoadMaster documentation yet. Pick a question below, or send your question to the LoadMaster team.',
  handoff: {
    ask: 'Send my question to the LoadMaster team',
    notRight: 'Not what you needed? Ask the LoadMaster team',
    intro: 'Questions I asked the {name} assistant:',
  },
} satisfies Dictionary<typeof source>
