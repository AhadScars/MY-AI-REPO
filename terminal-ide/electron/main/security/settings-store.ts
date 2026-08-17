import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import { DEFAULT_SETTINGS, type AppSettings } from '../../../packages/types/src/settings.js';

/**
 * Persistent settings store for the main process.
 * Writes JSON under userData. API keys must never be stored here in plaintext
 * in later phases — use OS credential vaults.
 */
export class SettingsStore {
  private filePath = '';
  private data: AppSettings = structuredClone(DEFAULT_SETTINGS);
  private ready = false;
  /** Serialize all writes so concurrent set() calls cannot clobber each other. */
  private writeChain: Promise<void> = Promise.resolve();

  async init(): Promise<void> {
    this.filePath = path.join(app.getPath('userData'), 'settings.json');
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<AppSettings>;
      this.data = this.mergeDefaults(parsed);
    } catch {
      this.data = structuredClone(DEFAULT_SETTINGS);
      await this.persist();
    }
    this.ready = true;
  }

  private mergeDefaults(partial: Partial<AppSettings>): AppSettings {
    const p = partial as Partial<AppSettings> & {
      // migrate old free-form keys if present in older settings.json
      editor?: AppSettings['editor'] & { session?: AppSettings['session'] };
    };
    // Prefer top-level session; fall back to legacy editor.session
    const legacySession = (p.editor as { session?: AppSettings['session'] } | undefined)?.session;
    return {
      general: { ...DEFAULT_SETTINGS.general, ...p.general },
      editor: { ...DEFAULT_SETTINGS.editor, ...p.editor },
      terminal: { ...DEFAULT_SETTINGS.terminal, ...p.terminal },
      ai: { ...DEFAULT_SETTINGS.ai, ...p.ai },
      git: { ...DEFAULT_SETTINGS.git, ...p.git },
      privacy: { ...DEFAULT_SETTINGS.privacy, ...p.privacy },
      layout: { ...DEFAULT_SETTINGS.layout, ...p.layout },
      workspace: {
        ...DEFAULT_SETTINGS.workspace,
        ...p.workspace,
        // Ensure array fields stay arrays after partial merges
        recentPaths: Array.isArray(p.workspace?.recentPaths)
          ? p.workspace!.recentPaths!
          : DEFAULT_SETTINGS.workspace.recentPaths,
        expandedPaths: Array.isArray(p.workspace?.expandedPaths)
          ? p.workspace!.expandedPaths!
          : DEFAULT_SETTINGS.workspace.expandedPaths,
      },
      session: {
        ...DEFAULT_SETTINGS.session,
        ...(p.session ?? legacySession ?? {}),
        openPaths: Array.isArray((p.session ?? legacySession)?.openPaths)
          ? ((p.session ?? legacySession)!.openPaths as string[])
          : DEFAULT_SETTINGS.session.openPaths,
      },
      shortcuts: { ...DEFAULT_SETTINGS.shortcuts, ...p.shortcuts },
    };
  }

  private async persist(): Promise<void> {
    if (!this.filePath) return;
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  getAll(): AppSettings {
    return structuredClone(this.data);
  }

  get<T = unknown>(key: string): T | undefined {
    const parts = key.split('.');
    let current: unknown = this.data;
    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }
    return current as T;
  }

  private applyKey(root: Record<string, unknown>, key: string, value: unknown): void {
    const parts = key.split('.');
    if (parts.length === 0) return;
    let cursor: Record<string, unknown> = root;
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]!;
      const existing = cursor[part];
      if (existing === null || existing === undefined || typeof existing !== 'object') {
        cursor[part] = {};
      }
      cursor = cursor[part] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]!] = value;
  }

  async set(key: string, value: unknown): Promise<void> {
    const run = async () => {
      const next = structuredClone(this.data) as unknown as Record<string, unknown>;
      this.applyKey(next, key, value);
      this.data = next as unknown as AppSettings;
      await this.persist();
    };
    const queued = this.writeChain.then(run, run);
    this.writeChain = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  /** Apply many keys then write once (atomic snapshot for quit flush). */
  async setMany(entries: Record<string, unknown>): Promise<void> {
    const run = async () => {
      const next = structuredClone(this.data) as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(entries)) {
        this.applyKey(next, key, value);
      }
      this.data = next as unknown as AppSettings;
      await this.persist();
    };
    const queued = this.writeChain.then(run, run);
    this.writeChain = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  async reset(): Promise<void> {
    const run = async () => {
      this.data = structuredClone(DEFAULT_SETTINGS);
      await this.persist();
    };
    const queued = this.writeChain.then(run, run);
    this.writeChain = queued.then(
      () => undefined,
      () => undefined,
    );
    return queued;
  }

  isReady(): boolean {
    return this.ready;
  }
}
