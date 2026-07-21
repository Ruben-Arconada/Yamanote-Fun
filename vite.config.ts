import { defineConfig } from 'vite'

// Served from https://<user>.github.io/Yamanote-Fun/ in production (GitHub Pages
// project site), so assets need that base path; local dev stays at '/'.
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/Yamanote-Fun/' : '/',
}))
