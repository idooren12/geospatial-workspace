import { useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';
import { toolRegistry } from '../tools/ToolRegistry';
import type { ToolDefinition } from '../tools/types';

export function useTools(): readonly ToolDefinition[] {
  return useSyncExternalStore(toolRegistry.subscribe, toolRegistry.getSnapshot);
}

export function useToolName() {
  const { t } = useTranslation();
  return (tool: ToolDefinition | undefined, fallback: string) =>
    tool ? (tool.nameKey ? t(tool.nameKey) : tool.name) : fallback;
}
