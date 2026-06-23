import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Relative base so the build works under a GitHub Pages project subpath
  // (https://user.github.io/<repo>/). HashRouter handles routing.
  base: './',
  plugins: [react()],
  server: { port: 5173, open: true },
})
