import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// IMPORTANT: GitHub Pages repo subfolder
const GITHUB_BASE = '/invertfm/';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    // Needed so all assets / links are resolved as /invertfm/...
    base: GITHUB_BASE,

    // Build into "docs" so GitHub Pages can serve it from main/docs
    build: {
      outDir: 'docs',
    },

    server: {
      port: 3000,
      host: '0.0.0.0',
    },

    plugins: [react()],

    define: {
      // Safely expose your Gemini key (empty string if not set)
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY ?? ''),
      // Optional: expose the base path if you ever need it in code
      __APP_BASE__: JSON.stringify(GITHUB_BASE),
    },

    resolve: {
      alias: {
        // Use the project root as "@"
        '@': path.resolve(__dirname, '.'),
      },
    },
  };
});
