import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useLayoutStore } from '../../stores/layoutStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useAIStore } from '../../stores/aiStore';
import { requireApi } from '../../services/platform';
import type { ThemeMode } from '../../../packages/types/src/settings';
import type { AICredentialProviderId } from '../../../packages/protocol/src/ai';

export function SettingsPanel() {
  const open = useLayoutStore((s) => s.settingsOpen);
  const close = useLayoutStore((s) => s.closeSettings);
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const reset = useSettingsStore((s) => s.reset);

  const providers = useAIStore((s) => s.providers);
  const activeProviderId = useAIStore((s) => s.activeProviderId);
  const activeModel = useAIStore((s) => s.activeModel);
  const setProvider = useAIStore((s) => s.setProvider);
  const setModel = useAIStore((s) => s.setModel);

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [keyStatus, setKeyStatus] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  const provider = providers.find((p) => p.id === activeProviderId);

  useEffect(() => {
    if (!open) return;
    void (async () => {
      try {
        const has = await requireApi().aiHasCredential({
          providerId: activeProviderId as AICredentialProviderId,
        });
        setHasKey(has);
        setApiKeyInput('');
        setKeyStatus(has ? 'API key is saved (encrypted).' : 'No API key saved.');
      } catch {
        setHasKey(false);
        setKeyStatus(null);
      }
    })();
  }, [open, activeProviderId]);

  if (!open) return null;

  const saveKey = async () => {
    try {
      await requireApi().aiSetCredential({
        providerId: activeProviderId as AICredentialProviderId,
        apiKey: apiKeyInput,
      });
      setApiKeyInput('');
      const has = await requireApi().aiHasCredential({
        providerId: activeProviderId as AICredentialProviderId,
      });
      setHasKey(has);
      setKeyStatus(has ? 'API key saved securely.' : 'API key cleared.');
    } catch (err) {
      setKeyStatus(err instanceof Error ? err.message : 'Failed to save key');
    }
  };

  const clearKey = async () => {
    try {
      await requireApi().aiDeleteCredential({
        providerId: activeProviderId as AICredentialProviderId,
      });
      setHasKey(false);
      setApiKeyInput('');
      setKeyStatus('API key removed.');
    } catch (err) {
      setKeyStatus(err instanceof Error ? err.message : 'Failed to remove key');
    }
  };

  const testConnection = async () => {
    setTestStatus('Testing…');
    try {
      const result = await requireApi().aiTestConnection({
        providerId: activeProviderId,
        baseUrl: settings.ai.baseUrl,
      });
      setTestStatus(result.ok ? `✓ ${result.message}` : `✗ ${result.message}`);
    } catch (err) {
      setTestStatus(err instanceof Error ? err.message : 'Test failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog">
      <button
        type="button"
        className="absolute inset-0 bg-black/50"
        aria-label="Close settings"
        onClick={close}
      />
      <div className="relative z-10 flex h-[80vh] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-ide-border bg-ide-surface shadow-2xl">
        <div className="flex h-10 items-center justify-between border-b border-ide-border px-4">
          <h2 className="text-ide-md font-semibold text-ide-text">Settings</h2>
          <button
            type="button"
            onClick={close}
            className="rounded-sm p-1 text-ide-muted hover:bg-ide-elevated hover:text-ide-text"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-6">
          {/* General */}
          <section className="mb-8">
            <h3 className="mb-3 text-ide-sm font-semibold uppercase tracking-wide text-ide-muted">
              General
            </h3>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Theme</span>
              <select
                className="rounded-sm border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm"
                value={settings.general.theme}
                onChange={(e) => void setTheme(e.target.value as ThemeMode)}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </label>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Open last workspace on startup</span>
              <input
                type="checkbox"
                checked={settings.general.openLastWorkspace}
                onChange={(e) =>
                  void updateSetting('general', { openLastWorkspace: e.target.checked })
                }
              />
            </label>
          </section>

          {/* Editor */}
          <section className="mb-8">
            <h3 className="mb-3 text-ide-sm font-semibold uppercase tracking-wide text-ide-muted">
              Editor
            </h3>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Font size</span>
              <input
                type="number"
                min={10}
                max={28}
                className="w-20 rounded-sm border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm"
                value={settings.editor.fontSize}
                onChange={(e) =>
                  void updateSetting('editor', { fontSize: Number(e.target.value) || 14 })
                }
              />
            </label>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Tab size</span>
              <input
                type="number"
                min={1}
                max={8}
                className="w-20 rounded-sm border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm"
                value={settings.editor.tabSize}
                onChange={(e) =>
                  void updateSetting('editor', { tabSize: Number(e.target.value) || 2 })
                }
              />
            </label>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Minimap</span>
              <input
                type="checkbox"
                checked={settings.editor.minimap}
                onChange={(e) => void updateSetting('editor', { minimap: e.target.checked })}
              />
            </label>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Word wrap</span>
              <select
                className="rounded-sm border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm"
                value={settings.editor.wordWrap}
                onChange={(e) =>
                  void updateSetting('editor', {
                    wordWrap: e.target.value as typeof settings.editor.wordWrap,
                  })
                }
              >
                <option value="off">Off</option>
                <option value="on">On</option>
              </select>
            </label>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Auto save</span>
              <select
                className="rounded-sm border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm"
                value={settings.editor.autoSave}
                onChange={(e) =>
                  void updateSetting('editor', {
                    autoSave: e.target.value as typeof settings.editor.autoSave,
                  })
                }
              >
                <option value="off">Off</option>
                <option value="afterDelay">After Delay</option>
                <option value="onFocusChange">On Focus Change</option>
                <option value="onWindowChange">On Window Change</option>
              </select>
            </label>
          </section>

          {/* AI */}
          <section className="mb-8">
            <h3 className="mb-3 text-ide-sm font-semibold uppercase tracking-wide text-ide-muted">
              AI
            </h3>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Provider</span>
              <select
                className="rounded-sm border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm"
                value={activeProviderId}
                onChange={(e) => {
                  const id = e.target.value;
                  setProvider(id);
                  const patch: { provider: string; model?: string; baseUrl?: string } = {
                    provider: id,
                  };
                  if (id === 'deepseek') {
                    patch.model = 'deepseek-chat';
                    patch.baseUrl = 'https://api.deepseek.com';
                    setModel('deepseek-chat');
                  }
                  void updateSetting('ai', patch);
                }}
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Model</span>
              <select
                className="rounded-sm border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm"
                value={activeModel}
                onChange={(e) => {
                  setModel(e.target.value);
                  void updateSetting('ai', { model: e.target.value });
                }}
              >
                {(provider?.models ?? []).map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Base URL (optional)</span>
              <input
                type="text"
                placeholder={
                  activeProviderId === 'ollama'
                    ? 'http://127.0.0.1:11434/v1'
                    : activeProviderId === 'deepseek'
                      ? 'https://api.deepseek.com'
                      : 'https://api.openai.com/v1'
                }
                className="w-64 rounded-sm border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm"
                value={settings.ai.baseUrl ?? ''}
                onChange={(e) =>
                  void updateSetting('ai', { baseUrl: e.target.value || undefined })
                }
              />
            </label>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Temperature</span>
              <input
                type="number"
                min={0}
                max={2}
                step={0.1}
                className="w-20 rounded-sm border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm"
                value={settings.ai.temperature}
                onChange={(e) =>
                  void updateSetting('ai', { temperature: Number(e.target.value) })
                }
              />
            </label>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Max tokens</span>
              <input
                type="number"
                min={256}
                max={128000}
                step={256}
                className="w-24 rounded-sm border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm"
                value={settings.ai.maxTokens}
                onChange={(e) =>
                  void updateSetting('ai', { maxTokens: Number(e.target.value) || 4096 })
                }
              />
            </label>
            <div className="mb-3 rounded-sm border border-ide-border p-3">
              <div className="mb-2 text-ide-sm font-medium">API key ({provider?.name})</div>
              <input
                type="password"
                autoComplete="off"
                placeholder={hasKey ? '••••••••  (enter new key to replace)' : 'sk-…'}
                className="mb-2 w-full rounded-sm border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="rounded-sm bg-ide-accent px-2 py-1 text-ide-xs text-white hover:bg-ide-accent-hover"
                  onClick={() => void saveKey()}
                  disabled={!apiKeyInput.trim()}
                >
                  Save key
                </button>
                <button
                  type="button"
                  className="rounded-sm border border-ide-border px-2 py-1 text-ide-xs text-ide-danger hover:bg-ide-elevated"
                  onClick={() => void clearKey()}
                  disabled={!hasKey}
                >
                  Remove key
                </button>
                <button
                  type="button"
                  className="rounded-sm border border-ide-border px-2 py-1 text-ide-xs hover:bg-ide-elevated"
                  onClick={() => void testConnection()}
                >
                  Test connection
                </button>
              </div>
              {keyStatus && <p className="mt-2 text-ide-xs text-ide-muted">{keyStatus}</p>}
              {testStatus && <p className="mt-1 text-ide-xs text-ide-muted">{testStatus}</p>}
              <p className="mt-2 text-ide-xs text-ide-muted">
                Keys are encrypted with the OS credential vault (Electron safeStorage) when
                available. Never committed to disk as plain settings.
              </p>
            </div>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">
                Agent mode
                <span className="mt-0.5 block text-ide-xs font-normal text-ide-muted">
                  AI uses tools to read/search/edit your project
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.ai.agentMode}
                onChange={(e) => void updateSetting('ai', { agentMode: e.target.checked })}
              />
            </label>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">
                Auto-apply agent edits
                <span className="mt-0.5 block text-ide-xs font-normal text-ide-muted">
                  Write files immediately (off = review in Diff panel)
                </span>
              </span>
              <input
                type="checkbox"
                checked={settings.ai.autoApplyEdits !== false}
                onChange={(e) =>
                  void updateSetting('ai', { autoApplyEdits: e.target.checked })
                }
              />
            </label>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Enable autocomplete</span>
              <input
                type="checkbox"
                checked={settings.ai.enableAutocomplete}
                onChange={(e) =>
                  void updateSetting('ai', { enableAutocomplete: e.target.checked })
                }
              />
            </label>
          </section>

          {/* Terminal */}
          <section className="mb-8">
            <h3 className="mb-3 text-ide-sm font-semibold uppercase tracking-wide text-ide-muted">
              Terminal
            </h3>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Default shell</span>
              <select
                className="rounded-sm border border-ide-border bg-ide-bg px-2 py-1 text-ide-sm"
                value={settings.terminal.defaultShell}
                onChange={(e) =>
                  void updateSetting('terminal', {
                    defaultShell: e.target.value as typeof settings.terminal.defaultShell,
                  })
                }
              >
                <option value="auto">Auto</option>
                <option value="powershell">PowerShell</option>
                <option value="cmd">CMD</option>
                <option value="git-bash">Git Bash</option>
                <option value="wsl">WSL</option>
              </select>
            </label>
          </section>

          {/* Privacy */}
          <section className="mb-8">
            <h3 className="mb-3 text-ide-sm font-semibold uppercase tracking-wide text-ide-muted">
              Privacy
            </h3>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Telemetry</span>
              <input
                type="checkbox"
                checked={settings.privacy.telemetry}
                onChange={(e) => void updateSetting('privacy', { telemetry: e.target.checked })}
              />
            </label>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Codebase indexing</span>
              <input
                type="checkbox"
                checked={settings.privacy.indexingEnabled}
                onChange={(e) =>
                  void updateSetting('privacy', { indexingEnabled: e.target.checked })
                }
              />
            </label>
            <label className="mb-3 flex items-center justify-between gap-4">
              <span className="text-ide-sm">Share code with AI</span>
              <input
                type="checkbox"
                checked={settings.privacy.shareCodeWithAI}
                onChange={(e) =>
                  void updateSetting('privacy', { shareCodeWithAI: e.target.checked })
                }
              />
            </label>
          </section>

          <button
            type="button"
            onClick={() => void reset()}
            className="rounded-sm border border-ide-border px-3 py-1.5 text-ide-sm text-ide-danger hover:bg-ide-elevated"
          >
            Reset All Settings
          </button>
        </div>
      </div>
    </div>
  );
}
