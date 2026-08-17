import type { PermissionDecision, PermissionLevel } from '../../types/src/ai';

export interface PermissionPolicy {
  level: PermissionLevel;
  description: string;
}

/**
 * Session + durable permission decisions for AI tools.
 */
export class PermissionManager {
  private session = new Map<string, PermissionDecision>();
  private always = new Map<string, PermissionDecision>();

  setAlways(toolName: string, decision: PermissionDecision): void {
    if (decision === 'always-allow' || decision === 'deny') {
      this.always.set(toolName, decision);
    }
  }

  setSession(toolName: string, decision: PermissionDecision): void {
    this.session.set(toolName, decision);
  }

  clearSession(): void {
    this.session.clear();
  }

  /**
   * Returns whether the tool may run without prompting.
   * `null` means the UI should ask the user.
   */
  evaluate(toolName: string, level: PermissionLevel): boolean | null {
    if (level === 'safe') return true;

    const always = this.always.get(toolName);
    if (always === 'always-allow') return true;
    if (always === 'deny') return false;

    const session = this.session.get(toolName);
    if (session === 'allow-session' || session === 'allow-once' || session === 'always-allow') {
      if (session === 'allow-once') this.session.delete(toolName);
      return true;
    }
    if (session === 'deny') return false;

    // confirm / high-risk need user
    return null;
  }

  applyDecision(toolName: string, decision: PermissionDecision): void {
    if (decision === 'always-allow' || decision === 'deny') {
      this.always.set(toolName, decision);
      this.session.delete(toolName);
      return;
    }
    if (decision === 'allow-session') {
      this.session.set(toolName, decision);
      return;
    }
    if (decision === 'allow-once') {
      this.session.set(toolName, decision);
      return;
    }
    // deny once
    this.session.set(toolName, 'deny');
  }

  snapshot(): { session: Record<string, PermissionDecision>; always: Record<string, PermissionDecision> } {
    return {
      session: Object.fromEntries(this.session),
      always: Object.fromEntries(this.always),
    };
  }
}
