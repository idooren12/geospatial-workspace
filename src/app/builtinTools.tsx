import { Bug, Layers, PanelTop, Settings } from 'lucide-react';
import { DebugPanel, SamplePanel } from '../panels/DebugPanel';
import { LayersPanel } from '../panels/LayersPanel';
import { SettingsPanel } from '../panels/SettingsPanel';
import { toolRegistry } from '../tools';

/** Platform panels, registered through the same registry future domain tools use. */
toolRegistry.register({
  id: 'layers',
  name: 'Layers',
  nameKey: 'tools.layers',
  icon: <Layers size={18} aria-hidden />,
  defaultDock: 'left',
  component: LayersPanel,
  order: 0,
});

toolRegistry.register({
  id: 'settings',
  name: 'Settings',
  nameKey: 'tools.settings',
  icon: <Settings size={18} aria-hidden />,
  defaultDock: 'right',
  component: SettingsPanel,
  order: 90,
});

// Development-only helpers (spec §8 allows a small internal debug tool). Absent from production.
toolRegistry.register({
  id: 'debug',
  name: 'Debug',
  nameKey: 'tools.debug',
  icon: <Bug size={18} aria-hidden />,
  defaultDock: 'right',
  component: DebugPanel,
  order: 99,
  devOnly: true,
});

toolRegistry.register({
  id: 'sample',
  name: 'Sample',
  nameKey: 'tools.sample',
  icon: <PanelTop size={18} aria-hidden />,
  defaultDock: 'left',
  component: SamplePanel,
  order: 98,
  devOnly: true,
});
