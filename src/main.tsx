import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

window.addEventListener('unhandledrejection', (event) => {
  const msg = String(event.reason?.message || event.reason || '');
  if (msg.includes('WebSocket closed without opened')) {
    event.preventDefault();
  }
});

try {
  registerSW({immediate: true});
} catch {
  // Ignore if service workers are unavailable in this context
}

createRoot(document.getElementById('root')!).render(<App />);
