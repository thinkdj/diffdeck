// Sample repos for the hosted demo (vite --mode demo). Shaped exactly like GET /api/repos.
// A solo founder's ~/code: one SaaS with its api and web, a landing page, a mobile app, a browser extension,
// a newsletter, a support bot with its prompts, and a blog. Times are relative to now so the demo never ages.
// Metadata edits really work here, through the same functions the server uses, but live only until you reload.
import { removeField, saveField, setValue, withMeta } from '../server/meta.js'

const ROOT = '/Users/sam/code'
const now = Math.floor(Date.now() / 1000)
const m = 60, h = 3600, d = 86400

let seed = 20261108
const hash = () => ((seed = (seed * 48271) % 2147483647) >>> 0).toString(16).padStart(8, '0').slice(-7)
const commits = (...list) => list.map(([ago, subject]) => ({ hash: hash(), time: now - ago, subject }))
const files = (...list) => list.map((line) => ({ code: line.slice(0, 2), path: line.slice(3) }))

function repo(name, { parent, files: f = [], ...rest }) {
  const path = `${ROOT}/${parent ? `${parent}/` : ''}${name}`
  return {
    path, name, parent: parent ? `${ROOT}/${parent}` : null,
    branch: 'main', upstream: 'origin/main', ahead: 0, behind: 0, stash: 0,
    conflicts: f.filter((x) => x.code.includes('U')).length,
    hasRemote: true, web: `https://github.com/yourname/${parent ? `${parent}-` : ''}${name}`,
    files: f, changed: f.length, pkg: null,
    ...rest,
  }
}

// package.json samples: { scripts, dependencies, devDependencies }. The api has enough of both to need "View all".
const pkg = (scripts, dependencies = {}, devDependencies = {}) => ({ scripts, dependencies, devDependencies })
const repos = [
  repo('invoice-app', {
    ahead: 2, stash: 1,
    pkg: pkg({ dev: 'pnpm -r --parallel dev', build: 'pnpm -r build', test: 'pnpm -r test', lint: 'eslint .' }, {}, { eslint: '^9.30.0', prettier: '^3.6.0', typescript: '^5.9.0' }),
    files: files(' M package.json', ' M docker-compose.yml'),
    commits: commits(
      [2 * h, 'Point api and web at the new billing flow'],
      [1 * d, 'Add a staging environment to docker compose'],
      [3 * d, 'Share one eslint config across api and web'],
      [8 * d, 'Move api and web into one workspace'],
      [20 * d, 'Set up the workspace'],
    ),
  }),
  repo('api', {
    parent: 'invoice-app', branch: 'stripe-webhooks', upstream: 'origin/stripe-webhooks', ahead: 3, behind: 1,
    pkg: pkg(
      { 'db:migrate': 'prisma migrate deploy', 'db:seed': 'tsx scripts/seed.ts', 'db:studio': 'prisma studio', dev: 'tsx watch src/index.ts', build: 'tsc -p tsconfig.build.json', start: 'node dist/index.js', test: 'vitest run', 'test:watch': 'vitest', lint: 'eslint src', typecheck: 'tsc --noEmit', 'stripe:listen': 'stripe listen --forward-to localhost:3000/webhooks/stripe', 'docker:up': 'docker compose up -d' },
      { fastify: '^5.4.0', '@fastify/cors': '^11.0.0', '@fastify/rate-limit': '^10.3.0', '@prisma/client': '^6.12.0', stripe: '^18.3.0', zod: '^4.0.0', pino: '^9.7.0', 'pino-pretty': '^13.0.0', nodemailer: '^7.0.0', dayjs: '^1.11.13', bullmq: '^5.56.0', ioredis: '^5.6.0' },
      { prisma: '^6.12.0', tsx: '^4.20.0', typescript: '^5.9.0', vitest: '^3.2.0', '@types/node': '^24.0.0', '@types/nodemailer': '^6.4.17' },
    ),
    files: files(' M src/billing/webhooks.ts', ' M src/billing/plans.ts', 'A  src/billing/refunds.ts', '?? src/billing/refunds.test.ts', ' M .env.example', ' D src/legacy/paypal.ts', 'R  src/mail/receipt.ts'),
    commits: commits(
      [25 * m, 'Handle failed payment webhooks'],
      [3 * h, 'Retry webhook delivery with backoff'],
      [5 * h, 'Add a refund endpoint'],
      [1 * d, 'Verify the Stripe signature on every webhook'],
      [2 * d, 'Add the Stripe webhook route'],
    ),
  }),
  repo('web', {
    parent: 'invoice-app',
    pkg: pkg({ dev: 'next dev', build: 'next build', start: 'next start', lint: 'next lint' }, { next: '^15.4.0', react: '^19.1.0', 'react-dom': '^19.1.0', swr: '^2.3.0' }, { tailwindcss: '^4.1.0', typescript: '^5.9.0' }),
    commits: commits(
      [6 * h, 'Show plan limits on the billing page'],
      [1 * d, 'Fix invoice PDF download on Safari'],
      [2 * d, 'Add dark mode'],
      [4 * d, 'Polish the onboarding checklist'],
      [9 * d, 'Use the new design tokens in charts'],
    ),
  }),
  repo('landing-page', {
    pkg: pkg({ dev: 'astro dev', build: 'astro build', preview: 'astro preview' }, { astro: '^5.12.0' }, { sharp: '^0.34.0' }),
    commits: commits(
      [4 * h, 'Pricing: the yearly plan is now two months free'],
      [2 * d, 'Add quotes from the first ten customers'],
      [5 * d, 'Compress the hero images'],
      [15 * d, 'Add privacy policy and terms'],
      [40 * d, 'Launch page'],
    ),
  }),
  repo('mobile-app', {
    branch: 'release-1.4', upstream: 'origin/release-1.4', behind: 3,
    pkg: pkg({ start: 'expo start', ios: 'expo run:ios', android: 'expo run:android', test: 'jest', 'build:ios': 'eas build -p ios', 'build:android': 'eas build -p android' }, { expo: '~53.0.0', react: '19.0.0', 'react-native': '0.79.5', 'expo-local-authentication': '~16.0.0', 'expo-secure-store': '~14.2.0', '@react-navigation/native': '^7.1.0' }, { jest: '^29.7.0', 'jest-expo': '~53.0.0' }),
    files: files(' M app/screens/Invoices.tsx', ' M app.json'),
    commits: commits(
      [1 * d, 'Bump version to 1.4.0'],
      [2 * d, 'Keep invoice drafts when offline'],
      [3 * d, 'Fix a push notification crash on Android'],
      [7 * d, 'Cache the customer list'],
      [16 * d, 'Add Face ID login'],
    ),
  }),
  repo('chrome-extension', {
    branch: 'export-csv', upstream: '',
    pkg: pkg({ dev: 'vite', build: 'vite build', zip: 'node scripts/zip.js' }, {}, { vite: '^7.0.0', typescript: '^5.9.0', '@crxjs/vite-plugin': '^2.0.0' }),
    files: files('?? src/export/csv.ts'),
    commits: commits(
      [30 * m, 'Export the current table as CSV'],
      [1 * h, 'Add an Export button to the toolbar'],
    ),
  }),
  repo('newsletter', {
    upstream: '', hasRemote: false, web: null,
    files: files(' M template.html', '?? issues/2026-11-10.md', '?? issues/2026-11-17.md'),
    commits: commits([3 * d, 'First issue of the weekly founder newsletter']),
  }),
  repo('support-bot', {
    behind: 1,
    pkg: pkg({ start: 'node src/index.js', dev: 'node --watch src/index.js', test: 'node --test' }, { '@anthropic-ai/sdk': '^0.57.0', '@slack/bolt': '^4.4.0' }),
    files: files('UU src/reply.ts', 'UU package.json', ' M src/index.ts'),
    commits: commits(
      [2 * h, 'Answer billing questions from the help center'],
      [1 * d, 'Post replies to Slack'],
      [3 * d, 'Limit replies per customer per hour'],
      [6 * d, 'Log every conversation for review'],
      [21 * d, 'First working bot'],
    ),
  }),
  repo('prompts', {
    parent: 'support-bot', ahead: 1,
    commits: commits(
      [40 * m, 'Soften the refund reply'],
      [2 * d, 'Add prompts for onboarding questions'],
      [8 * d, 'Add the first prompt set'],
    ),
  }),
  repo('blog', {
    behind: 2, stash: 2,
    pkg: pkg({ dev: 'eleventy --serve', build: 'eleventy' }, {}, { '@11ty/eleventy': '^3.1.0', '@11ty/eleventy-plugin-rss': '^2.0.0' }),
    commits: commits(
      [3 * d, 'Post: how I got my first 100 customers'],
      [9 * d, 'Post: pricing experiments that failed'],
      [17 * d, 'Add an RSS feed'],
      [35 * d, 'Post: why I build in public'],
      [70 * d, 'Set up the blog'],
    ),
  }),
]

// Sample metadata: a global field of each type, plus local ones on the mobile app and the api. Shaped like ~/.diffdeck.json.
const inDays = (n) => new Date(Date.now() + n * d * 1000).toISOString().slice(0, 10)
const at = (name) => `${ROOT}/${name}`
let cfg = {
  fields: [
    { key: 'Live', desc: 'Customers use it in production', type: 'boolean' },
    { key: 'Stack', desc: 'Main framework or language', type: 'string' },
    { key: 'Review by', desc: 'When to look at this repo again', type: 'date' },
    { key: 'Notes', desc: 'Anything worth remembering next time', type: 'text' },
    { key: 'App Store', desc: 'Is the latest build live in the store?', type: 'boolean', repo: at('mobile-app') },
    { key: 'Stripe mode', desc: 'Which Stripe keys this branch uses', type: 'string', repo: at('invoice-app/api') },
  ],
  meta: {
    [at('invoice-app')]: { Live: true, Stack: 'pnpm workspace', 'Review by': inDays(7) },
    [at('invoice-app/api')]: { Live: true, Stack: 'Fastify + Postgres', 'Stripe mode': 'Test', Notes: 'Stripe keys live in the password manager, never in .env.\nThe webhook secret rotates every 90 days.' },
    [at('invoice-app/web')]: { Live: true, Stack: 'Next.js' },
    [at('landing-page')]: { Live: true, Stack: 'Astro' },
    [at('mobile-app')]: { Live: true, Stack: 'Expo', 'Review by': inDays(2), Notes: 'Release 1.4 is in App Store review. Merge main before the next build.' },
    [at('chrome-extension')]: { Stack: 'Vite + TypeScript' },
    [at('newsletter')]: { 'Review by': inDays(1), Notes: 'Add a remote before the first real send.' },
    [at('support-bot')]: { Live: true, Stack: 'Node' },
    [at('blog')]: { Stack: 'Eleventy' },
  },
}
const view = () => structuredClone({ roots: [{ path: ROOT, count: repos.length }], fields: cfg.fields, repos: repos.map((r) => withMeta(cfg, r)) })

// Stands in for fetch('/api' + url): reads and metadata edits work, changing the watched folders explains the demo.
export async function demoApi(url, opts = {}) {
  const method = opts.method ?? 'GET'
  const { pathname, searchParams } = new URL(url, 'http://demo')
  const body = JSON.parse(opts.body ?? '{}')
  if (pathname === '/fields' && method === 'POST') cfg = saveField(cfg, body)
  else if (pathname === '/fields' && method === 'DELETE') cfg = removeField(cfg, searchParams.get('key'), searchParams.get('repo'))
  else if (pathname === '/meta') cfg = setValue(cfg, body)
  else if (method !== 'GET') throw new Error('This demo shows sample repos. Run npx diffdeck on your computer to watch your own.')
  return view()
}
