import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import api, { PORT } from './server/api.js'

// pnpm dev: the git API runs inside Vite's dev server, on diffdeck's own port.
// --mode demo: the page uses sample repos instead (src/demo.js), and builds to dist-demo/ with relative
// paths, so it can be hosted anywhere, including a GitHub Pages subfolder.
const mountApi = { name: 'diffdeck-api', configureServer: (server) => { server.middlewares.use('/api', api) } }

export default defineConfig(({ mode }) => ({
  base: mode === 'demo' ? './' : '/',
  build: { outDir: mode === 'demo' ? 'dist-demo' : 'dist' },
  server: { port: PORT },
  plugins: [react(), mountApi],
}))
