import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/global.css';
import './app/builtinTools';
import { initI18n } from './i18n';
import { DEFAULT_BASEMAP_ID } from './map/basemaps.config';
import { persistence } from './persistence';
import { useWorkspace } from './store/workspaceStore';
import { App } from './app/App';

async function main() {
  // Storage is read (and migrated) once, before the first render; the store then owns the state.
  useWorkspace.getState().hydrate(await persistence.load(DEFAULT_BASEMAP_ID));
  initI18n(useWorkspace.getState().settings.language);

  const root = document.getElementById('root');
  if (!root) throw new Error('#root missing');
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void main();
