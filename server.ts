import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // API Route Handler — maps /api/:route to api/:route.js
  app.all('/api/:route', async (req, res, next) => {
    const route = req.params.route;
    if (route.startsWith('_')) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const filePath = path.join(process.cwd(), 'api', `${route}.js`);
    if (fs.existsSync(filePath)) {
      try {
        const module = await import(`./api/${route}.js?t=${Date.now()}`);
        const handler = module.default || module;
        if (typeof handler === 'function') {
          return handler(req, res);
        }
      } catch (err: any) {
        console.error(`Error executing API route /api/${route}:`, err);
        return res.status(500).json({ error: err.message || 'Internal Server Error' });
      }
    }
    next();
  });

  // Health endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Vite Middleware in Dev, static file serving in Production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
