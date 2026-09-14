import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { handleGoogleRedirect } from './lib/googleAuth';
import { initializeIndexedDbPersistence } from './lib/indexedDbPersistence';

async function bootstrap() {
  await initializeIndexedDbPersistence();
  handleGoogleRedirect();

  const container = document.getElementById('root');
  if (!container) return;

  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

bootstrap();
