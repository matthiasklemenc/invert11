
// quick build id to verify we’re on the latest bundle
;(window as any).__BUILD_ID__ = 'build-' + new Date().toISOString();
console.log('Loaded', (window as any).__BUILD_ID__);

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './build/App';

// FIX: Cannot find name 'document'.
// FIX: Property 'document' does not exist on type 'Window'.
// Fix: Use global `document` directly.
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);