import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'NEXT_PUBLIC_']);
  const processEnvDefines: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    processEnvDefines[`process.env.${key}`] = JSON.stringify(value);
  }

  const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';
  const pagesCompatibility: Plugin = {
    name: 'github-pages-compatibility',
    enforce: 'pre',
    transform(code, id) {
      if (!isGitHubPages || !id.endsWith('/src/App.tsx')) return null;
      return code.replace(
        "import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';",
        "import { HashRouter as BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';",
      );
    },
    transformIndexHtml(html) {
      return html.replace(/\s*<script data-arena-(?:recording|views)="true">[\s\S]*?<\/script>/g, '');
    },
  };

  return {
    base: isGitHubPages ? '/tawasul-marriage-platform/' : '/',
    plugins: [pagesCompatibility, react(), tailwindcss()],
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: processEnvDefines,
    server: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
    },
    preview: {
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
    },
  };
})
