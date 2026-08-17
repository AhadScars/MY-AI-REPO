import { app, safeStorage } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AICredentialProviderId } from '../../../packages/protocol/src/ai.js';

interface CredentialFile {
  version: 1;
  /** providerId -> encrypted base64 or plaintext fallback marker */
  entries: Record<string, { enc: string; method: 'safeStorage' | 'plaintext-dev' }>;
}

/**
 * OS-backed credential storage using Electron safeStorage when available.
 * API keys never go to the renderer after save (only hasKey boolean).
 */
export class CredentialStore {
  private filePath = '';
  private data: CredentialFile = { version: 1, entries: {} };
  private ready = false;

  async init(): Promise<void> {
    this.filePath = path.join(app.getPath('userData'), 'credentials.enc.json');
    try {
      const raw = await fs.readFile(this.filePath, 'utf-8');
      this.data = JSON.parse(raw) as CredentialFile;
      if (!this.data.entries) this.data.entries = {};
    } catch {
      this.data = { version: 1, entries: {} };
    }
    this.ready = true;
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });
    await fs.writeFile(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
  }

  async set(providerId: AICredentialProviderId, apiKey: string): Promise<void> {
    const key = apiKey.trim();
    if (!key) {
      await this.delete(providerId);
      return;
    }

    if (safeStorage.isEncryptionAvailable()) {
      const buf = safeStorage.encryptString(key);
      this.data.entries[providerId] = {
        enc: buf.toString('base64'),
        method: 'safeStorage',
      };
    } else {
      // Dev fallback (WSL/headless) — still never log the key
      this.data.entries[providerId] = {
        enc: Buffer.from(key, 'utf-8').toString('base64'),
        method: 'plaintext-dev',
      };
    }
    await this.persist();
  }

  get(providerId: AICredentialProviderId): string | null {
    const entry = this.data.entries[providerId];
    if (!entry) return null;
    try {
      if (entry.method === 'safeStorage' && safeStorage.isEncryptionAvailable()) {
        return safeStorage.decryptString(Buffer.from(entry.enc, 'base64'));
      }
      return Buffer.from(entry.enc, 'base64').toString('utf-8');
    } catch {
      return null;
    }
  }

  has(providerId: AICredentialProviderId): boolean {
    return Boolean(this.data.entries[providerId]?.enc);
  }

  async delete(providerId: AICredentialProviderId): Promise<void> {
    delete this.data.entries[providerId];
    await this.persist();
  }

  isReady(): boolean {
    return this.ready;
  }
}
