/**
 * Domain tools register here, one line each, e.g.
 *   import { myTool } from './my-tool';  toolRegistry.register(myTool);
 * Stage 0 has no domain tools. Built-in platform panels register in src/app/builtinTools.tsx.
 */
export { toolRegistry } from './ToolRegistry';
export type { ToolContext, ToolDefinition, ToolPanelProps } from './types';
