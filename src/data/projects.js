// All portfolio content lives here. Pages read from this file, and the build
// script uses it to write a share-friendly HTML page for every project.
//
// TODO (Leon): each project has a `role` and `result` field set to null.
// Fill them with what you personally did and one result you can back up.
// Sections with null values are simply not shown on the site.

export const site = {
  name: 'Leon Jr Chua',
  short: 'Leon Jr',
  url: 'https://the-leonjr.github.io',
  pitch:
    'I build things you can poke at: an app that finds your meme twin, a phone button that runs a stock robot, and a game about one unanswered message.',
  fact: 'Applied AI · Temasek Polytechnic · Singapore',
  email: 'leonjr.chua.008@gmail.com',
  github: 'https://github.com/The-leonjr',
  githubHandle: '@The-leonjr',
  linkedin: 'https://www.linkedin.com/in/leon-jr-chua-750851373/',
  resume: null, // put a PDF in /public and set e.g. '/Leon-Jr-Chua-Resume.pdf'
};

export const groups = [
  {
    id: 'play',
    title: 'Things you can play with',
    note: 'A game you can open right now, and an app that reads your face.',
    projects: ['skip', 'memematch'],
  },
  {
    id: 'automate',
    title: 'Things that do the boring part',
    note: 'Automation and a model that turns survey data into an estimate.',
    projects: ['analysets', 'salarycalc'],
  },
  {
    id: 'apps',
    title: 'Apps',
    note: 'A Flutter app and a full database-backed website.',
    projects: ['aurafarm', 'animal-adoption'],
  },
];

export const projects = [
  {
    id: 'skip',
    name: 'SKIP',
    category: 'Browser game',
    kind: 'Game jam',
    hook: 'A game-jam browser game about drug abuse, lost time and a message that never gets an answer.',
    cover: '/images/skip-cover.webp',
    alt: 'SKIP pixel-art gameplay in a common room with characters and dialogue',
    primary: { label: 'Play SKIP', href: 'https://hannannoor.itch.io/skip' },
    source: 'https://github.com/The-leonjr/schoolprojectss/tree/main/SKIP_final',
    tech: ['JavaScript', 'Canvas', 'HTML and CSS', 'Narrative design'],
    credits: 'Made with Hannan Noor and Lucas for an anti-drug game jam. The source credits AI-assisted creation.',
    role: null,
    result: null,
    sections: [
      {
        title: 'The story',
        body: 'SKIP follows a student dealing with pressure, relationships and the pull to escape through drugs. You explore, talk to people and make choices, and the consequences show up in a changing world and in messages that stop getting replies.',
      },
      {
        title: 'Built for the browser',
        body: 'JavaScript and Canvas run the pixel-art rooms, dialogue, movement and procedural animation, so the player lives through the story instead of clicking through static screens. It is published on itch.io and plays in any desktop browser.',
      },
    ],
    images: [
      { src: '/images/skip-2.webp', caption: 'The title screen.' },
    ],
  },
  {
    id: 'memematch',
    name: 'MemeMatch',
    category: 'AI web app',
    kind: 'School project',
    hook: 'Upload a reaction photo and it finds the meme that matches your expression, then lets you post the match to a community feed.',
    cover: '/images/memematch-cover.webp',
    alt: 'MemeMatch reaction-photo upload interface with its expression analysis steps',
    primary: null,
    source: 'https://github.com/The-leonjr/schoolprojectss/tree/main/ctai-memematch',
    tech: ['JavaScript', 'AWS Lambda', 'Rekognition', 'Cognito', 'RDS MySQL'],
    credits: null,
    role: null,
    result: null,
    sections: [
      {
        title: 'From face to meme',
        body: 'You upload or capture a reaction photo. The app checks there is exactly one usable face, reads the expression with Amazon Rekognition and pairs it with a meme from the catalogue. Add a caption and the match becomes a post.',
      },
      {
        title: 'More than one AI call',
        body: 'Accounts, posts, likes, comments and notifications turn a single result into a social feed. The frontend talks to API Gateway and Lambda, Cognito handles sign-in, and RDS MySQL stores the memes and everything people post.',
      },
      {
        title: 'The tricky part',
        body: 'Photo validation, AI inference, database writes and signed-in actions all live in separate cloud services. Most of the work was in the steps between a successful analysis and a result someone can actually share.',
      },
    ],
    images: [],
  },
  {
    id: 'analysets',
    name: 'AnalyseTS',
    category: 'Automation',
    kind: 'School project',
    hook: 'I tap a shortcut on my phone, my laptop runs a UiPath robot over my stock watchlist, and the report lands in Discord.',
    cover: '/images/analysets-cover.webp',
    alt: 'AnalyseTS stock watchlist dashboard with an automation workflow, processing results and a movement chart',
    primary: null,
    source: 'https://github.com/The-leonjr/schoolprojectss/tree/main/rpa-analyseTs',
    tech: ['UiPath', 'Python', 'pandas', 'Streamlit', 'Plotly'],
    credits: null,
    role: null,
    result: null,
    sections: [
      {
        title: 'Start it from anywhere',
        body: 'A shortcut on my phone sends a run request. As long as the laptop is on and online, the robot picks it up and runs, so I never have to sit down and launch it by hand.',
      },
      {
        title: 'From watchlist to checked results',
        body: 'The run starts from an Excel watchlist. UiPath collects prices in the browser and reads them with OCR, then hands the results to Python to clean and validate. The checked data feeds a Streamlit dashboard with Plotly charts.',
      },
      {
        title: 'Reports and alerts',
        body: 'The robot writes the report and posts updates to Discord. It claims run requests from an Orchestrator queue and marks them done, and it also handles manual and scheduled runs. Errors are collected into a separate alert instead of disappearing inside the workflow.',
      },
    ],
    images: [
      { src: '/images/analysets-2.webp', caption: 'The UiPath workflow.' },
    ],
  },
  {
    id: 'salarycalc',
    name: 'Salarycalc',
    category: 'Machine learning',
    kind: 'School project',
    hook: "Describe a developer's experience and tools, and a model trained on the 2025 Stack Overflow survey estimates their salary.",
    cover: '/images/salarycalc-cover.webp',
    alt: 'Salarycalc developer salary estimator with work profile and technology inputs',
    primary: null,
    source: 'https://github.com/The-leonjr/schoolprojectss/tree/main/MLDP',
    tech: ['Python', 'pandas', 'scikit-learn', 'Streamlit', 'Altair'],
    credits: null,
    role: null,
    result: null,
    sections: [
      {
        title: 'Starting from the data',
        body: 'The project begins with the 2025 Stack Overflow Developer Survey: exploring it, filtering out unusable salaries and preparing features, before any model is trained.',
      },
      {
        title: 'Choosing a model',
        body: 'Several regression models were trained, tuned and compared on the prepared data, and the best one was carried forward into the app.',
      },
      {
        title: 'Making it usable',
        body: 'A Streamlit interface asks for experience, role, work setup and technologies, turns the answers into model inputs and shows the estimate. It connects a notebook workflow to something a person can try.',
      },
    ],
    images: [],
  },
  {
    id: 'aurafarm',
    name: 'AuraFarm',
    category: 'Mobile app',
    kind: 'School project',
    hook: 'A Flutter app that turns an outfit photo into an AI-assisted vibe card you can edit, set to music and share.',
    cover: '/images/aurafarm-cover.webp',
    alt: 'Two AuraFarm mobile screens showing the social feed and vibe-card editor',
    primary: null,
    source: 'https://github.com/The-leonjr/schoolprojectss/tree/main/mbap-aurafarm',
    tech: ['Flutter', 'Dart', 'Firebase', 'Riverpod', 'Gemini'],
    credits: null,
    role: null,
    result: null,
    portrait: true,
    sections: [
      {
        title: 'How it works',
        body: 'Pick a photo, let Gemini suggest a starting card, then adjust it in a visual editor before posting it to the in-app feed.',
      },
      {
        title: 'Under the hood',
        body: 'Flutter and Dart build the interface, Riverpod manages state, and Firebase Authentication and Firestore store accounts and posts. The hard part is keeping the editor responsive while AI requests run in the background.',
      },
    ],
    images: [
      { src: '/images/aurafarm-1.webp', caption: 'The feed.' },
      { src: '/images/aurafarm-2.webp', caption: 'The vibe-card editor.' },
      { src: '/images/aurafarm-3.webp', caption: 'Choosing a photo for a new card.' },
    ],
  },
  {
    id: 'animal-adoption',
    name: 'Animal Adoption',
    category: 'Web and database',
    kind: 'School project',
    hook: 'An adoption site where visitors browse animals and open their profiles, and admins add and update the listings.',
    cover: '/images/animal-adoption-cover.webp',
    alt: 'Animal Adoption detail screen with a large animal photo and listing information',
    primary: null,
    source: 'https://github.com/The-leonjr/schoolprojectss/tree/main/adev%20dbav-animal%20adoption',
    tech: ['JavaScript', 'Node.js', 'Express', 'MySQL', 'HTML and CSS'],
    credits: null,
    role: null,
    result: null,
    sections: [
      {
        title: 'Two sides',
        body: 'Visitors browse listings and open a profile for each animal. Admin screens add and update the records behind those listings.',
      },
      {
        title: 'Front to back',
        body: 'HTML, CSS and JavaScript render the listings and forms. A Node.js and Express server connects them to MySQL, so a change made in a form shows up in the listings straight away.',
      },
    ],
    images: [
      { src: '/images/animal-adoption-2.webp', caption: 'The listings.' },
    ],
  },
];

export const byId = Object.fromEntries(projects.map((p) => [p.id, p]));

// SKIP is the featured project: a plain card on the hero, there before the 3D loads.
export const featured = 'skip';

// The other five orbit the orb. They rest mostly behind it and come round when you turn it.
export const sphereOrder = ['memematch', 'analysets', 'aurafarm', 'salarycalc', 'animal-adoption'];

export const toolkit = [
  ['Web and cloud', 'JavaScript, Node.js, Express, MySQL, AWS'],
  ['Mobile and AI', 'Flutter, Dart, Firebase, Gemini'],
  ['Data and ML', 'Python, pandas, scikit-learn, Streamlit'],
  ['Automation', 'UiPath, OCR, Plotly'],
];
