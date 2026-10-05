import { useWorkspace } from '../../store/workspaceStore';

/** Side that points from the map controls into the map: they sit on the inline-end edge. */
export function useInwardSide(): 'left' | 'right' {
  return useWorkspace((s) => s.settings.language) === 'he' ? 'right' : 'left';
}
