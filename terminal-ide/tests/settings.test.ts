import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../packages/types/src/settings';

describe('DEFAULT_SETTINGS', () => {
  it('has required sections', () => {
    expect(DEFAULT_SETTINGS.general.theme).toBe('dark');
    expect(DEFAULT_SETTINGS.editor.fontSize).toBeGreaterThan(0);
    expect(DEFAULT_SETTINGS.ai.provider).toBeTruthy();
    expect(DEFAULT_SETTINGS.layout.sidebarVisible).toBe(true);
    expect(DEFAULT_SETTINGS.privacy.telemetry).toBe(false);
  });

  it('includes core shortcuts', () => {
    expect(DEFAULT_SETTINGS.shortcuts['workbench.action.showCommands']).toBe('Ctrl+Shift+P');
    expect(DEFAULT_SETTINGS.shortcuts['workbench.action.files.save']).toBe('Ctrl+S');
  });
});
