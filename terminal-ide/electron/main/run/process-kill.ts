/**
 * Kill process trees and free TCP ports so Spring Boot / Node servers
 * do not leave ports bound after Stop.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Extract listening ports from server logs (Spring Boot, Node, etc.). */
export function extractPortsFromOutput(text: string): number[] {
  const ports = new Set<number>();
  const patterns = [
    /Tomcat started on port(?:\(s\))?:\s*(\d+)/gi,
    /Netty started on port(?:\(s\))?:\s*(\d+)/gi,
    /Jetty started on port(?:\(s\))?:\s*(\d+)/gi,
    /Undertow started on port(?:\(s\))?:\s*(\d+)/gi,
    /Listening on port[:\s]+(\d+)/gi,
    /started on port(?:\(s\))?:\s*(\d+)/gi,
    /server\.port\s*[=:]\s*(\d+)/gi,
    /Local:\s+https?:\/\/[^:\s]+:(\d+)/gi,
    /http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/gi,
    /bound to\s+.*:(\d+)/gi,
  ];
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const p = Number(m[1]);
      if (p > 0 && p < 65536) ports.add(p);
    }
  }
  return [...ports];
}

/** Read server.port from Spring application.properties / yml if present. */
export function readConfiguredServerPort(projectRoot: string): number | null {
  const candidates = [
    path.join(projectRoot, 'src', 'main', 'resources', 'application.properties'),
    path.join(projectRoot, 'src', 'main', 'resources', 'application.yml'),
    path.join(projectRoot, 'src', 'main', 'resources', 'application.yaml'),
    path.join(projectRoot, 'application.properties'),
  ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, 'utf-8');
      // properties: server.port=8081
      let m = text.match(/^\s*server\.port\s*=\s*(\d+)\s*$/m);
      if (m) {
        const p = Number(m[1]);
        if (p > 0 && p < 65536) return p;
      }
      // yaml: server:\n  port: 8081  OR server.port: 8081
      m = text.match(/^\s*port:\s*(\d+)\s*$/m) || text.match(/server\.port:\s*(\d+)/);
      if (m) {
        const p = Number(m[1]);
        if (p > 0 && p < 65536) return p;
      }
    } catch {
      // continue
    }
  }
  return null;
}

/** Kill a process and all descendants (Maven → Java → Spring Boot). */
export function killProcessTree(pid: number): void {
  if (!pid || pid <= 0) return;

  if (process.platform === 'win32') {
    // /T = tree, /F = force — required so java.exe children die with mvnw/cmd
    spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
      windowsHide: true,
      shell: false,
      stdio: 'ignore',
      timeout: 8000,
    });
    return;
  }

  // Unix: try process group first, then the pid itself
  try {
    process.kill(-pid, 'SIGTERM');
  } catch {
    // not a group leader
  }
  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // already dead
  }
  // Brief grace then SIGKILL
  try {
    spawnSync('kill', ['-9', `-${pid}`], { stdio: 'ignore', timeout: 2000 });
  } catch {
    // ignore
  }
  try {
    process.kill(pid, 'SIGKILL');
  } catch {
    // ignore
  }
}

/** PIDs currently LISTENING on a TCP port. */
export function pidsListeningOnPort(port: number): number[] {
  if (port <= 0 || port >= 65536) return [];

  if (process.platform === 'win32') {
    try {
      const out = execFileSync('netstat', ['-ano', '-p', 'tcp'], {
        encoding: 'utf8',
        windowsHide: true,
        timeout: 5000,
      });
      const pids = new Set<number>();
      // TCP    0.0.0.0:8081           0.0.0.0:0              LISTENING       12345
      // TCP    [::]:8081              [::]:0                 LISTENING       12345
      const re = new RegExp(
        String.raw`^\s*TCP\s+\S+:${port}\s+\S+\s+LISTENING\s+(\d+)\s*$`,
        'gim',
      );
      let m: RegExpExecArray | null;
      while ((m = re.exec(out)) !== null) {
        const pid = Number(m[1]);
        if (pid > 0 && pid !== process.pid) pids.add(pid);
      }
      return [...pids];
    } catch {
      return [];
    }
  }

  // Linux / macOS
  try {
    const out = execFileSync('sh', ['-c', `lsof -tiTCP:${port} -sTCP:LISTEN 2>/dev/null || true`], {
      encoding: 'utf8',
      timeout: 5000,
    });
    return out
      .split(/\s+/)
      .map((s) => Number(s.trim()))
      .filter((n) => n > 0 && n !== process.pid);
  } catch {
    return [];
  }
}

/** Force-free a TCP port by killing listeners. */
export function freePort(port: number): number[] {
  const pids = pidsListeningOnPort(port);
  for (const pid of pids) {
    killProcessTree(pid);
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/PID', String(pid), '/T', '/F'], {
        windowsHide: true,
        shell: false,
        stdio: 'ignore',
        timeout: 5000,
      });
    } else {
      try {
        process.kill(pid, 'SIGKILL');
      } catch {
        // ignore
      }
    }
  }
  return pids;
}

/** Free many ports; returns unique PIDs killed. */
export function freePorts(ports: number[]): { ports: number[]; pids: number[] } {
  const uniquePorts = [...new Set(ports.filter((p) => p > 0 && p < 65536))];
  const pids = new Set<number>();
  const freed: number[] = [];
  for (const port of uniquePorts) {
    const killed = freePort(port);
    if (killed.length > 0) {
      freed.push(port);
      for (const p of killed) pids.add(p);
    }
  }
  return { ports: freed, pids: [...pids] };
}
