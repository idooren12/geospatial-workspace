import { DirectionProvider } from '@radix-ui/react-direction';
import * as Tooltip from '@radix-ui/react-tooltip';
import { dirOf } from '../i18n';
import { useWorkspace } from '../store/workspaceStore';
import { Workspace } from './Workspace';

export function App() {
  const language = useWorkspace((s) => s.settings.language);
  return (
    <DirectionProvider dir={dirOf(language)}>
      <Tooltip.Provider delayDuration={400}>
        <Workspace />
      </Tooltip.Provider>
    </DirectionProvider>
  );
}
