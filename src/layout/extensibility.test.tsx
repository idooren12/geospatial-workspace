import * as Tooltip from '@radix-ui/react-tooltip';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../i18n';
import { useWorkspace } from '../store/workspaceStore';
import { toolRegistry } from '../tools/ToolRegistry';
import type { ToolPanelProps } from '../tools/types';
import { DockArea } from './DockArea';

/** A tool the platform has never heard of, added by registration only (spec §8, M5 #22). */
function ProbePanel({ ctx }: ToolPanelProps) {
  return <p>probe panel for {ctx.toolId}</p>;
}
function BrokenPanel(): never {
  throw new Error('boom');
}

beforeAll(() => {
  initI18n('en');
  toolRegistry.register({ id: 'probe', name: 'Probe', icon: <span>P</span>, defaultDock: 'left', component: ProbePanel });
  toolRegistry.register({ id: 'broken', name: 'Broken', icon: <span>B</span>, defaultDock: 'right', component: BrokenPanel });
});

const renderWorkspaceBody = () =>
  render(
    <Tooltip.Provider>
      <DockArea map={<div data-testid="fake-map" />} />
    </Tooltip.Provider>,
  );

describe('Tool Registry extensibility', () => {
  it('a registered tool gets a rail button and opens as a docked panel, with no other code', () => {
    act(() => useWorkspace.getState().setBodyWidth(1600));
    renderWorkspaceBody();
    const btn = screen.getByTestId('rail-btn-probe');
    expect(btn).toHaveAccessibleName('Probe');
    fireEvent.click(btn);
    expect(screen.getByText('probe panel for probe')).toBeInTheDocument();
    expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  it('a crashing tool panel is contained by its error boundary; the rest keeps working', () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderWorkspaceBody();
    fireEvent.click(screen.getByTestId('rail-btn-broken'));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByTestId('fake-map')).toBeInTheDocument();
    err.mockRestore();
  });
});
