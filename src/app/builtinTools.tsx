import { Bug, Layers, PanelTop, Pencil, Ruler, Settings } from 'lucide-react';
import { DebugPanel, SamplePanel } from '../panels/DebugPanel';
import { LayersPanel } from '../panels/LayersPanel';
import { DrawPanel } from '../panels/DrawPanel';
import { DrawingLayerDetails } from '../panels/DrawingList';
import { MeasurePanel } from '../panels/MeasurePanel';
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
  rail: false, // opened from the layers button on the map
});

toolRegistry.register({
  id: 'measure',
  name: 'Measurements',
  nameKey: 'tools.measure',
  icon: <Ruler size={18} aria-hidden />,
  defaultDock: 'right',
  component: MeasurePanel,
  order: 10,
  rail: false, // opened from the ruler button on the map
});

toolRegistry.register({
  id: 'draw',
  name: 'Draw',
  nameKey: 'tools.draw',
  icon: <Pencil size={18} aria-hidden />,
  defaultDock: 'right',
  component: DrawPanel,
  order: 20,
  rail: false, // opened from the pencil button on the map
  layerDetails: DrawingLayerDetails, // the shapes of its layers, listed in the Layers panel
});

toolRegistry.register({
  id: 'settings',
  name: 'Settings',
  nameKey: 'tools.settings',
  icon: <Settings size={18} aria-hidden />,
  defaultDock: 'right',
  component: SettingsPanel,
  order: 90,
  rail: false, // opened from the top bar
});

// Development-only helpers (spec §8 allows a small internal debug tool). The constant condition
// lets the production build drop them entirely, code included (M5 security review).
if (import.meta.env.DEV) {
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
}
