// pnpm screenshot: serves the built demo (dist-demo/) and saves docs/screenshot.png with headless Chrome, for the README.
// Vite's preview server plus the Chrome (or Edge, or Chromium) already on the machine. The capture is taken at 2x,
// then sharp (a dev dependency) scales it to 1600px wide and writes a 256-colour palette PNG, which is far smaller.
// Set CHROME to the browser's path if it isn't found. ?open= opens a repo and ?filters unfolds the metadata filters.
import { execFile } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import sharp from 'sharp'
import { preview } from 'vite'

const OUT = path.resolve('docs/screenshot.png')
const WIDTH = 1600 // the README image; the height follows the 1440x1000 window's aspect
const OPEN = '/Users/sam/code/invoice-app/api' // the demo repo with the most to show
const CANDIDATES = [
  process.env.CHROME,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]
const chrome = CANDIDATES.find((p) => p && fs.existsSync(p))
if (!chrome) throw new Error('No Chrome, Edge or Chromium found. Set CHROME to its path.')

const server = await preview({ mode: 'demo', preview: { port: 4748, open: false } })
try {
  const url = server.resolvedUrls.local[0] + '?filters&open=' + encodeURIComponent(OPEN) // filters unfolded too
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'diffdeck-shot-')) // its own profile: never hands off to a Chrome you have open
  const shot = path.join(profile, 'shot.png') // the raw 2x capture, never mistaken for an old one
  const { stderr } = await promisify(execFile)(chrome, [ // async: the preview server in this same process has to keep answering
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--user-data-dir=' + profile,
    '--window-size=1440,1000', '--force-device-scale-factor=2',
    '--virtual-time-budget=8000', // lets the page, its fonts and the demo data settle first
    '--screenshot=' + shot, url,
  ], { timeout: 60_000 })
  // On Windows the chrome.exe we started can return before the browser it handed off to has written the file.
  for (let i = 0; i < 60 && !fs.existsSync(shot); i++) await new Promise((r) => setTimeout(r, 500))
  if (!fs.existsSync(shot)) throw new Error(`Chrome saved no screenshot.
${stderr.trim().slice(-1500)}`)
  await new Promise((r) => setTimeout(r, 500)) // let the write finish
  const { width, height, size } = await sharp(shot)
    .resize({ width: WIDTH, kernel: 'lanczos3' })
    .png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 })
    .toFile(OUT)
  const before = fs.statSync(shot).size
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 })
  console.log(`Saved ${path.relative(process.cwd(), OUT)}: ${width}x${height}, ${Math.round(size / 1024)} KB (capture was ${Math.round(before / 1024)} KB)`)
} finally {
  await server.close()
}
