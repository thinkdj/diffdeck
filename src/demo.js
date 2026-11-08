// Sample repos for the hosted demo (vite --mode demo). Shaped exactly like GET /api/repos.
// A solo founder's ~/code: one SaaS with its api and web, a landing page, a mobile app, a browser extension,
// a newsletter, a support bot with its prompts, and a blog. Times are relative to now so the demo never ages.
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
    files: f, changed: f.length,
    ...rest,
  }
}

const repos = [
  repo('invoice-app', {
    ahead: 2, stash: 1,
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
    commits: commits(
      [6 * h, 'Show plan limits on the billing page'],
      [1 * d, 'Fix invoice PDF download on Safari'],
      [2 * d, 'Add dark mode'],
      [4 * d, 'Polish the onboarding checklist'],
      [9 * d, 'Use the new design tokens in charts'],
    ),
  }),
  repo('landing-page', {
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
    commits: commits(
      [3 * d, 'Post: how I got my first 100 customers'],
      [9 * d, 'Post: pricing experiments that failed'],
      [17 * d, 'Add an RSS feed'],
      [35 * d, 'Post: why I build in public'],
      [70 * d, 'Set up the blog'],
    ),
  }),
]

const data = { roots: [{ path: ROOT, count: repos.length }], repos }

// Stands in for fetch('/api' + url): reads work, anything that would change the list explains the demo.
export async function demoApi(url, opts = {}) {
  if ((opts.method ?? 'GET') === 'GET') return structuredClone(data)
  throw new Error('This demo shows sample repos. Run npx diffdeck on your computer to watch your own.')
}
