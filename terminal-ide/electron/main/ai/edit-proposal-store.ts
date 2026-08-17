import { randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { BrowserWindow } from 'electron';
import { IpcChannels } from '../../../packages/protocol/src/ipc-channels.js';
import type { FileEditProposal } from '../../../packages/protocol/src/edits.js';

/**
 * Holds pending AI multi-file edits until the user accepts/rejects.
 */
export class EditProposalStore {
  private proposals = new Map<string, FileEditProposal>();

  constructor(private getWindow: () => BrowserWindow | null) {}

  private notify(): void {
    this.getWindow()?.webContents.send(IpcChannels.EVENT_EDITS_CHANGED, {
      proposals: this.list(),
    });
  }

  list(): FileEditProposal[] {
    return [...this.proposals.values()].sort((a, b) => b.createdAt - a.createdAt);
  }

  listPending(): FileEditProposal[] {
    return this.list().filter((p) => p.status === 'pending' || p.status === 'conflict');
  }

  propose(
    edits: Array<{
      path: string;
      originalContent?: string;
      proposedContent: string;
      description?: string;
    }>,
    source: FileEditProposal['source'] = 'agent',
    opts?: { silent?: boolean },
  ): FileEditProposal[] {
    const created: FileEditProposal[] = [];
    for (const e of edits) {
      const abs = path.resolve(e.path);
      const id = randomUUID();
      const proposal: FileEditProposal = {
        id,
        path: abs,
        originalContent: e.originalContent ?? '',
        proposedContent: e.proposedContent,
        description: e.description,
        status: 'pending',
        source,
        createdAt: Date.now(),
      };
      this.proposals.set(id, proposal);
      created.push(proposal);
    }
    if (!opts?.silent) this.notify();
    return created;
  }

  /** Propose and write immediately (agent auto-apply). Single notify after apply. */
  async proposeAndApply(
    edits: Array<{
      path: string;
      originalContent?: string;
      proposedContent: string;
      description?: string;
    }>,
    source: FileEditProposal['source'] = 'agent',
  ): Promise<{ applied: number; failed: number; paths: string[] }> {
    const created = this.propose(edits, source, { silent: true });
    let applied = 0;
    let failed = 0;
    const paths: string[] = [];
    for (const p of created) {
      const r = await this.apply(p.id, true);
      if (r.ok) {
        applied += 1;
        paths.push(p.path);
      } else {
        failed += 1;
      }
    }
    this.notify();
    return { applied, failed, paths };
  }

  async apply(id: string, force = false): Promise<{ ok: boolean; error?: string; conflict?: boolean }> {
    const p = this.proposals.get(id);
    if (!p) return { ok: false, error: 'Proposal not found' };
    if (p.status === 'applied' || p.status === 'rejected') {
      return { ok: false, error: `Already ${p.status}` };
    }

    try {
      let current = '';
      try {
        current = await fs.readFile(p.path, 'utf-8');
      } catch {
        current = '';
      }

      // Conflict if file changed since proposal and we have an original baseline
      if (
        !force &&
        p.originalContent !== '' &&
        current !== p.originalContent &&
        current !== p.proposedContent
      ) {
        p.status = 'conflict';
        this.proposals.set(id, p);
        this.notify();
        return {
          ok: false,
          conflict: true,
          error: 'File changed since proposal was created. Review and force-apply if intended.',
        };
      }

      await fs.mkdir(path.dirname(p.path), { recursive: true });
      await fs.writeFile(p.path, p.proposedContent, 'utf-8');
      p.status = 'applied';
      this.proposals.set(id, p);
      this.notify();
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async applyAll(ids?: string[], force = false): Promise<{ applied: number; failed: number }> {
    const targets = ids?.length
      ? ids
      : this.listPending().map((p) => p.id);
    let applied = 0;
    let failed = 0;
    for (const id of targets) {
      const r = await this.apply(id, force);
      if (r.ok) applied += 1;
      else failed += 1;
    }
    return { applied, failed };
  }

  reject(id: string): void {
    const p = this.proposals.get(id);
    if (!p) return;
    p.status = 'rejected';
    this.proposals.set(id, p);
    this.notify();
  }

  rejectAll(): void {
    for (const p of this.proposals.values()) {
      if (p.status === 'pending' || p.status === 'conflict') {
        p.status = 'rejected';
      }
    }
    this.notify();
  }

  clear(): void {
    this.proposals.clear();
    this.notify();
  }

  get(id: string): FileEditProposal | undefined {
    return this.proposals.get(id);
  }
}
