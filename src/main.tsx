import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import { initI18n } from './i18n';
import { useWorkspace } from './store/workspaceStore';
import { App } from './app/App';

initI18n(useWorkspace.getState().settings.language);

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
