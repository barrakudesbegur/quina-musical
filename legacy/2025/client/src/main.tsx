import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { App } from './App.tsx';
import { Providers } from './components/Providers.tsx';

import './index.css';

registerSW({ immediate: true });

import '@fontsource/londrina-solid/100.css';
import '@fontsource/londrina-solid/300.css';
import '@fontsource/londrina-solid/400.css';
import '@fontsource/londrina-solid/900.css';

// Handle SPA redirect from GitHub Pages
const redirect = sessionStorage.getItem('spa-redirect');
if (redirect) {
  sessionStorage.removeItem('spa-redirect');
  window.history.replaceState(null, '', redirect);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Providers>
      <App />
    </Providers>
  </StrictMode>
);
