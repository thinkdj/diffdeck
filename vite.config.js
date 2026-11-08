import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import api from './server/api.js'

// The git API runs inside Vite's own server (dev and preview): one process, no separate backend.
const mountApi = (server) => { server.middlewares.use('/api', api) }

export default defineConfig({
  plugins: [react(), { name: 'diffdeck-api', configureServer: mountApi, configurePreviewServer: mountApi }],
})
