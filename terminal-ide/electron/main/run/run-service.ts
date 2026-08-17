import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { BrowserWindow } from 'electron';
import { IpcChannels } from '../../../packages/protocol/src/ipc-channels.js';
import type {
  ProjectDepsAction,
  ProjectDepsRequest,
  ProjectToolDetectResult,
  RunDetectResult,
  RunExitEvent,
  RunOutputEvent,
  RunProgramRequest,
  RunProgramResult,
  RunStopResult,
  RunWriteRequest,
} from '../../../packages/protocol/src/run.js';
import {
  extractPortsFromOutput,
  freePorts,
  killProcessTree,
  readConfiguredServerPort,
} from './process-kill.js';

interface ActiveRun {
  id: string;
  proc: ChildProcessWithoutNullStreams;
  startedAt: number;
  /** TCP ports this run opened (Spring Boot, etc.) — freed on Stop */
  ports: Set<number>;
  /** Project root when known (for application.properties port) */
  projectRoot?: string;
}

interface CommandStep {
  cmd: string;
  args: string[];
  cwd: string;
  /** Shown in Output before the command (IntelliJ-style phase label) */
  message?: string;
}

interface CommandPlan {
  label: string;
  /** Sequential command steps (e.g. resolve deps, then spring-boot:run) */
  steps: CommandStep[];
}

export type BuildTool = 'maven' | 'gradle';

export interface JavaProjectInfo {
  root: string;
  tool: BuildTool;
  isSpringBoot: boolean;
  /** Absolute path to mvnw/gradlew wrapper when present */
  wrapperPath: string | null;
  buildFile: string;
}

/** Extract `package name;` from Java source (first match). */
export function readJavaPackage(source: string): string {
  const m = source.match(/^\s*package\s+([\w.]+)\s*;/m);
  return m ? m[1] : '';
}

/** Fully-qualified main class: `pkg.Name` or bare `Name`. */
export function resolveJavaMainClass(fileNameNoExt: string, packageName: string): string {
  return packageName ? `${packageName}.${fileNameNoExt}` : fileNameNoExt;
}

/**
 * If the file lives under directories matching the package path
 * (e.g. src/school/Foo.java + package school), return the source root (src).
 * Otherwise return the file's directory.
 */
export function resolveJavaSourceRoot(fileDir: string, packageName: string): string {
  if (!packageName) return fileDir;
  const segments = packageName.split('.');
  let root = fileDir;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (path.basename(root) === segments[i]) {
      root = path.dirname(root);
    } else {
      break;
    }
  }
  return root;
}

/** Collect .java files under root (skips out/bin/build/node_modules). */
export function collectJavaFiles(root: string, maxDepth = 8): string[] {
  const results: string[] = [];
  const skip = new Set(['out', 'bin', 'build', 'target', 'node_modules', '.git']);

  const walk = (dir: string, depth: number) => {
    if (depth > maxDepth) return;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (skip.has(e.name) || e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full, depth + 1);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.java')) results.push(full);
    }
  };

  walk(root, 0);
  return results;
}

/** True when source defines a Spring Boot entrypoint. */
export function isSpringBootApplicationSource(source: string): boolean {
  return /@SpringBootApplication\b/.test(source);
}

/** Detect Spring Boot from Maven pom.xml contents. */
export function isSpringBootPom(pomXml: string): boolean {
  const text = pomXml.toLowerCase();
  return (
    text.includes('spring-boot') ||
    text.includes('springframework.boot') ||
    text.includes('spring-boot-starter') ||
    text.includes('spring-boot-maven-plugin')
  );
}

/** Detect Spring Boot from Gradle build script contents. */
export function isSpringBootGradle(buildScript: string): boolean {
  const text = buildScript.toLowerCase();
  return (
    text.includes('org.springframework.boot') ||
    text.includes('spring-boot') ||
    text.includes('org.springframework.boot:spring-boot') ||
    /id\s*\(?\s*['"]org\.springframework\.boot['"]/.test(buildScript)
  );
}

function fileExists(p: string): boolean {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function readTextSafe(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Walk up from a file/dir and find the nearest Maven or Gradle project.
 * Prefers the closest build file; Spring Boot detection is based on that file.
 */
export function findJavaProject(startPath: string): JavaProjectInfo | null {
  let dir = path.resolve(startPath);
  try {
    if (fs.statSync(dir).isFile()) dir = path.dirname(dir);
  } catch {
    dir = path.dirname(dir);
  }

  const maxUp = 24;
  for (let i = 0; i < maxUp; i++) {
    const pom = path.join(dir, 'pom.xml');
    if (fileExists(pom)) {
      const content = readTextSafe(pom) ?? '';
      const wrapper =
        process.platform === 'win32'
          ? fileExists(path.join(dir, 'mvnw.cmd'))
            ? path.join(dir, 'mvnw.cmd')
            : fileExists(path.join(dir, 'mvnw.bat'))
              ? path.join(dir, 'mvnw.bat')
              : null
          : fileExists(path.join(dir, 'mvnw'))
            ? path.join(dir, 'mvnw')
            : null;
      return {
        root: dir,
        tool: 'maven',
        isSpringBoot: isSpringBootPom(content),
        wrapperPath: wrapper,
        buildFile: pom,
      };
    }

    const gradleKts = path.join(dir, 'build.gradle.kts');
    const gradleGroovy = path.join(dir, 'build.gradle');
    const buildFile = fileExists(gradleKts)
      ? gradleKts
      : fileExists(gradleGroovy)
        ? gradleGroovy
        : null;
    if (buildFile) {
      const content = readTextSafe(buildFile) ?? '';
      // settings.gradle may also reference Spring Boot in multi-project; check both
      const settings =
        readTextSafe(path.join(dir, 'settings.gradle.kts')) ??
        readTextSafe(path.join(dir, 'settings.gradle')) ??
        '';
      const wrapper =
        process.platform === 'win32'
          ? fileExists(path.join(dir, 'gradlew.bat'))
            ? path.join(dir, 'gradlew.bat')
            : fileExists(path.join(dir, 'gradlew.cmd'))
              ? path.join(dir, 'gradlew.cmd')
              : null
          : fileExists(path.join(dir, 'gradlew'))
            ? path.join(dir, 'gradlew')
            : null;
      return {
        root: dir,
        tool: 'gradle',
        isSpringBoot: isSpringBootGradle(content) || isSpringBootGradle(settings),
        wrapperPath: wrapper,
        buildFile,
      };
    }

    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * If the active file is a @SpringBootApplication class, return its FQN.
 */
export function resolveSpringBootMainClass(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== '.java') return null;
  const source = readTextSafe(filePath);
  if (!source || !isSpringBootApplicationSource(source)) return null;
  const pkg = readJavaPackage(source);
  const nameNoExt = path.basename(filePath, ext);
  return resolveJavaMainClass(nameNoExt, pkg);
}

/** Files that can trigger a Spring Boot project run (F5). */
export function isSpringBootRunnablePath(filePath: string): boolean {
  const base = path.basename(filePath).toLowerCase();
  const ext = path.extname(filePath).toLowerCase();
  if (base === 'pom.xml') return true;
  if (base === 'build.gradle' || base === 'build.gradle.kts') return true;
  if (base === 'application.properties' || base === 'application.yml' || base === 'application.yaml') {
    return true;
  }
  if (ext === '.java') return true;
  return false;
}

/**
 * Quote one argument for `cmd.exe /c` (spaces only — do not use with `/s`).
 */
function quoteWinArg(arg: string): string {
  if (!arg) return '""';
  if (!/[ \t"]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '""')}"`;
}

/**
 * Decode child-process stdout/stderr. Prefer UTF-8 so special characters show
 * correctly; fall back to latin1 on invalid UTF-8 (Windows code pages).
 */
function decodeProcessChunk(buf: Buffer): string {
  const utf8 = buf.toString('utf8');
  if (!utf8.includes('\uFFFD')) return utf8;
  if (process.platform === 'win32') {
    try {
      return buf.toString('latin1');
    } catch {
      return utf8;
    }
  }
  return utf8;
}

/**
 * True when the project has not been built/imported yet (no target/build output).
 * Used to show an IntelliJ-style "download dependencies" phase on first run.
 */
export function projectDependenciesLikelyMissing(
  projectRoot: string,
  tool: BuildTool,
): boolean {
  if (tool === 'maven') {
    const classes = path.join(projectRoot, 'target', 'classes');
    const depsMarker = path.join(projectRoot, 'target', 'maven-status');
    return !fileExists(classes) && !fileExists(depsMarker);
  }
  const gradleClasses = path.join(projectRoot, 'build', 'classes');
  const gradleLibs = path.join(projectRoot, 'build', 'libs');
  return !fileExists(gradleClasses) && !fileExists(gradleLibs);
}

/**
 * Safe program runner — always uses spawn(cmd, args) never shell strings.
 */
export class RunService {
  private active: ActiveRun | null = null;
  /** Ports from the last server run — freed even if the process already exited. */
  private lastKnownPorts = new Set<number>();
  private lastProjectRoot: string | undefined;

  constructor(private getWindow: () => BrowserWindow | null) {}

  private emitOutput(event: RunOutputEvent): void {
    this.getWindow()?.webContents.send(IpcChannels.EVENT_RUN_OUTPUT, event);
  }

  private emitExit(event: RunExitEvent): void {
    this.getWindow()?.webContents.send(IpcChannels.EVENT_RUN_EXIT, event);
  }

  private which(names: string[]): string | null {
    const pathEnv = process.env.PATH ?? process.env.Path ?? '';
    const sep = process.platform === 'win32' ? ';' : ':';
    const exts =
      process.platform === 'win32'
        ? (process.env.PATHEXT ?? '.EXE;.CMD;.BAT').split(';').filter(Boolean)
        : [''];

    for (const name of names) {
      for (const dir of pathEnv.split(sep)) {
        if (!dir) continue;
        for (const ext of exts) {
          const candidate = path.join(dir, name + (process.platform === 'win32' ? ext : ''));
          try {
            if (fs.existsSync(candidate)) return candidate;
          } catch {
            // continue
          }
        }
        const plain = path.join(dir, name);
        try {
          if (fs.existsSync(plain)) return plain;
        } catch {
          // continue
        }
      }
    }
    return null;
  }

  /**
   * Resolve Maven executable: project wrapper first, then mvn on PATH.
   */
  private resolveMavenCmd(project: JavaProjectInfo): string | null {
    if (project.wrapperPath && fileExists(project.wrapperPath)) return project.wrapperPath;
    return this.which(['mvn', 'mvn.cmd']);
  }

  /**
   * Resolve Gradle executable: project wrapper first, then gradle on PATH.
   */
  private resolveGradleCmd(project: JavaProjectInfo): string | null {
    if (project.wrapperPath && fileExists(project.wrapperPath)) return project.wrapperPath;
    return this.which(['gradle', 'gradle.bat']);
  }

  private detectSpringBoot(filePath: string): RunDetectResult | null {
    if (!isSpringBootRunnablePath(filePath)) return null;
    const project = findJavaProject(filePath);
    if (!project?.isSpringBoot) return null;

    const java = this.which(['java']);
    if (!java) {
      return {
        language: 'spring-boot',
        label: 'Spring Boot',
        available: false,
        reason:
          'Spring Boot project found (pom.xml / Gradle), but Java was not found. Install JDK 17+ and add it to PATH (set JAVA_HOME).',
      };
    }

    if (project.tool === 'maven') {
      const mvn = this.resolveMavenCmd(project);
      if (!mvn) {
        return {
          language: 'spring-boot',
          label: 'Spring Boot (Maven)',
          available: false,
          reason:
            'Spring Boot Maven project found, but Maven is missing. Keep mvnw.cmd in the project root or install Maven (mvn) on PATH.',
        };
      }
      const needDeps = projectDependenciesLikelyMissing(project.root, 'maven');
      return {
        language: 'spring-boot',
        label: needDeps ? 'Spring Boot (Maven) · deps missing' : 'Spring Boot (Maven)',
        available: true,
      };
    }

    const gradle = this.resolveGradleCmd(project);
    if (!gradle) {
      return {
        language: 'spring-boot',
        label: 'Spring Boot (Gradle)',
        available: false,
        reason:
          'Spring Boot Gradle project found, but Gradle is missing. Keep gradlew.bat in the project root or install Gradle on PATH.',
      };
    }
    const needDeps = projectDependenciesLikelyMissing(project.root, 'gradle');
    return {
      language: 'spring-boot',
      label: needDeps ? 'Spring Boot (Gradle) · deps missing' : 'Spring Boot (Gradle)',
      available: true,
    };
  }

  detect(filePath: string): RunDetectResult {
    const ext = path.extname(filePath).toLowerCase();
    const base = path.basename(filePath);

    // Spring Boot (Maven / Gradle) before plain Java so F5 uses spring-boot:run / bootRun
    const spring = this.detectSpringBoot(filePath);
    if (spring) return spring;

    if (ext === '.java') {
      const javac = this.which(['javac']);
      const java = this.which(['java']);
      if (!javac || !java) {
        return {
          language: 'java',
          label: 'Java',
          available: false,
          reason: 'JDK not found. Install a JDK and ensure javac/java are on PATH.',
        };
      }
      return { language: 'java', label: 'Java', available: true };
    }

    // Allow F5 on pom.xml / build.gradle even when not Spring Boot (package / build)
    if (base === 'pom.xml') {
      const project = findJavaProject(filePath);
      const mvn = project ? this.resolveMavenCmd(project) : this.which(['mvn', 'mvn.cmd']);
      return {
        language: 'maven',
        label: 'Maven package',
        available: Boolean(mvn),
        reason: mvn ? undefined : 'Maven not found. Install mvn or add the Maven wrapper (mvnw).',
      };
    }
    if (base === 'build.gradle' || base === 'build.gradle.kts') {
      const project = findJavaProject(filePath);
      const gradle = project ? this.resolveGradleCmd(project) : this.which(['gradle']);
      return {
        language: 'gradle',
        label: 'Gradle build',
        available: Boolean(gradle),
        reason: gradle
          ? undefined
          : 'Gradle not found. Install gradle or add the Gradle wrapper (gradlew).',
      };
    }

    if (ext === '.py' || ext === '.pyw') {
      const py = this.which(['python', 'python3', 'py']);
      if (!py) {
        return {
          language: 'python',
          label: 'Python',
          available: false,
          reason: 'Python not found on PATH.',
        };
      }
      return { language: 'python', label: 'Python', available: true };
    }

    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      const node = this.which(['node']);
      if (!node) {
        return {
          language: 'javascript',
          label: 'Node.js',
          available: false,
          reason: 'Node.js not found on PATH.',
        };
      }
      return { language: 'javascript', label: 'Node.js', available: true };
    }

    if (ext === '.ts' || ext === '.tsx') {
      const tsx = this.which(['tsx']);
      const tsNode = this.which(['ts-node']);
      const npx = this.which(['npx']);
      if (!tsx && !tsNode && !npx) {
        return {
          language: 'typescript',
          label: 'TypeScript',
          available: false,
          reason: 'Install tsx or ts-node (or Node with npx) to run TypeScript.',
        };
      }
      return { language: 'typescript', label: 'TypeScript', available: true };
    }

    if (ext === '.ps1') {
      const ps = this.which(['pwsh', 'powershell']);
      return {
        language: 'powershell',
        label: 'PowerShell',
        available: Boolean(ps),
        reason: ps ? undefined : 'PowerShell not found.',
      };
    }

    if (ext === '.sh' || ext === '.bash') {
      const bash = this.which(['bash', 'sh']);
      return {
        language: 'shell',
        label: 'Shell',
        available: Boolean(bash),
        reason: bash ? undefined : 'bash/sh not found.',
      };
    }

    if (ext === '.c') {
      const gcc = this.which(['gcc', 'clang']);
      return {
        language: 'c',
        label: 'C',
        available: Boolean(gcc),
        reason: gcc ? undefined : 'gcc/clang not found on PATH.',
      };
    }

    if (ext === '.cpp' || ext === '.cc' || ext === '.cxx') {
      const gpp = this.which(['g++', 'clang++']);
      return {
        language: 'cpp',
        label: 'C++',
        available: Boolean(gpp),
        reason: gpp ? undefined : 'g++/clang++ not found on PATH.',
      };
    }

    if (ext === '.go') {
      const go = this.which(['go']);
      return {
        language: 'go',
        label: 'Go',
        available: Boolean(go),
        reason: go ? undefined : 'go not found on PATH.',
      };
    }

    if (ext === '.rs') {
      const cargo = this.which(['cargo']);
      const rustc = this.which(['rustc']);
      return {
        language: 'rust',
        label: 'Rust',
        available: Boolean(cargo || rustc),
        reason: cargo || rustc ? undefined : 'rustc/cargo not found on PATH.',
      };
    }

    if (base === 'package.json') {
      const npm = this.which(['npm']);
      return {
        language: 'npm',
        label: 'npm start',
        available: Boolean(npm),
        reason: npm ? undefined : 'npm not found.',
      };
    }

    return {
      language: 'unknown',
      label: 'Run',
      available: false,
      reason: `No runner configured for ${ext || base}`,
    };
  }

  private planSpringBoot(
    filePath: string,
    project: JavaProjectInfo,
    extraArgs: string[],
  ): CommandPlan {
    const mainClass = resolveSpringBootMainClass(filePath);
    const root = project.root;
    const needDeps = projectDependenciesLikelyMissing(root, project.tool);
    const steps: CommandStep[] = [];

    // Dependencies are user-triggered from the Maven tool (left sidebar), like IntelliJ.
    const depsHint = needDeps
      ? '[Spring Boot] Dependencies not installed yet.\n' +
        '[Spring Boot] Open the Maven tool (left sidebar) → Install Dependencies, then Run again.\n' +
        '[Spring Boot] Starting anyway — Maven/Gradle will download on the fly if needed…\n'
      : '';

    if (project.tool === 'maven') {
      const mvn = this.resolveMavenCmd(project)!;
      const runArgs = ['-B', 'spring-boot:run', '-DskipTests'];
      if (mainClass) {
        runArgs.push(`-Dspring-boot.run.mainClass=${mainClass}`);
      }
      if (extraArgs.length > 0) {
        runArgs.push(`-Dspring-boot.run.arguments=${extraArgs.join(' ')}`);
      }
      steps.push({
        cmd: mvn,
        args: runArgs,
        cwd: root,
        message: `${depsHint}[Spring Boot] Starting application (Maven spring-boot:run)…\n`,
      });

      return {
        label: mainClass ? `Spring Boot (${mainClass})` : 'Spring Boot (Maven)',
        steps,
      };
    }

    const gradle = this.resolveGradleCmd(project)!;
    const runArgs = ['bootRun'];
    if (mainClass) {
      runArgs.push(`-Dspring-boot.run.mainClass=${mainClass}`);
    }
    if (extraArgs.length > 0) {
      runArgs.push(`--args=${extraArgs.join(' ')}`);
    }
    steps.push({
      cmd: gradle,
      args: runArgs,
      cwd: root,
      message: `${depsHint}[Spring Boot] Starting application (Gradle bootRun)…\n`,
    });

    return {
      label: mainClass ? `Spring Boot (${mainClass})` : 'Spring Boot (Gradle)',
      steps,
    };
  }

  /** Detect Maven/Gradle project for the sidebar Maven tool. */
  detectProject(rootPath: string): ProjectToolDetectResult {
    const project = findJavaProject(rootPath);
    if (!project) {
      return {
        found: false,
        tool: null,
        root: null,
        buildFile: null,
        isSpringBoot: false,
        dependenciesMissing: true,
        wrapper: null,
        runnerAvailable: false,
        label: 'No Maven/Gradle project',
        reason: 'No pom.xml or build.gradle found under this folder.',
      };
    }

    const runner =
      project.tool === 'maven'
        ? this.resolveMavenCmd(project)
        : this.resolveGradleCmd(project);
    const depsMissing = projectDependenciesLikelyMissing(project.root, project.tool);
    const toolLabel = project.tool === 'maven' ? 'Maven' : 'Gradle';
    const spring = project.isSpringBoot ? ' · Spring Boot' : '';

    return {
      found: true,
      tool: project.tool,
      root: project.root,
      buildFile: project.buildFile,
      isSpringBoot: project.isSpringBoot,
      dependenciesMissing: depsMissing,
      wrapper: project.wrapperPath,
      runnerAvailable: Boolean(runner),
      label: `${toolLabel}${spring}`,
      reason: runner
        ? undefined
        : project.tool === 'maven'
          ? 'Maven not found. Keep mvnw/mvnw.cmd in the project or install Maven on PATH.'
          : 'Gradle not found. Keep gradlew/gradlew.bat in the project or install Gradle on PATH.',
    };
  }

  /** User-triggered Install / Reinstall / Compile (IntelliJ-style). */
  async startProjectDeps(request: ProjectDepsRequest): Promise<RunProgramResult> {
    const project = findJavaProject(request.rootPath);
    if (!project) {
      throw new Error('No Maven or Gradle project found in this folder.');
    }

    const plan = this.planProjectDeps(project, request.action);
    this.stop();

    const runId = randomUUID();
    const startedAt = Date.now();
    const commandPreview = plan.steps
      .map((s) => `${s.cmd} ${s.args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`)
      .join(' && ');

    this.emitOutput({
      runId,
      stream: 'system',
      data: `> ${commandPreview}\n`,
    });

    void this.runSteps(runId, plan.steps, startedAt, project.root).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.emitOutput({
        runId,
        stream: 'system',
        data: `Error: ${message}\n`,
      });
      this.emitExit({
        runId,
        code: 1,
        durationMs: Date.now() - startedAt,
      });
      this.active = null;
    });

    return { runId, command: commandPreview, cwd: project.root };
  }

  private planProjectDeps(project: JavaProjectInfo, action: ProjectDepsAction): CommandPlan {
    const root = project.root;

    if (project.tool === 'maven') {
      const mvn = this.resolveMavenCmd(project);
      if (!mvn) {
        throw new Error(
          'Maven not found. Add mvnw.cmd to the project root or install Maven on PATH.',
        );
      }

      if (action === 'install') {
        return {
          label: 'Maven · Install Dependencies',
          steps: [
            {
              cmd: mvn,
              args: ['-B', 'dependency:resolve', '-DskipTests'],
              cwd: root,
              message:
                '[Maven] Installing dependencies (download from pom.xml)…\n' +
                '[Maven] This may take a few minutes on first run.\n',
            },
            {
              cmd: mvn,
              args: ['-B', 'compile', '-DskipTests'],
              cwd: root,
              message: '[Maven] Compiling project…\n',
            },
          ],
        };
      }

      if (action === 'reinstall') {
        return {
          label: 'Maven · Reinstall Dependencies',
          steps: [
            {
              cmd: mvn,
              args: ['-B', 'clean'],
              cwd: root,
              message: '[Maven] Cleaning target/ …\n',
            },
            {
              cmd: mvn,
              args: ['-B', 'dependency:resolve', '-U', '-DskipTests'],
              cwd: root,
              message:
                '[Maven] Reinstalling dependencies (forced update -U)…\n' +
                '[Maven] This may take a few minutes.\n',
            },
            {
              cmd: mvn,
              args: ['-B', 'compile', '-DskipTests'],
              cwd: root,
              message: '[Maven] Compiling project…\n',
            },
          ],
        };
      }

      // compile
      return {
        label: 'Maven · Compile',
        steps: [
          {
            cmd: mvn,
            args: ['-B', 'compile', '-DskipTests'],
            cwd: root,
            message: '[Maven] Compiling project…\n',
          },
        ],
      };
    }

    // Gradle
    const gradle = this.resolveGradleCmd(project);
    if (!gradle) {
      throw new Error(
        'Gradle not found. Add gradlew.bat to the project root or install Gradle on PATH.',
      );
    }

    if (action === 'install') {
      return {
        label: 'Gradle · Install Dependencies',
        steps: [
          {
            cmd: gradle,
            args: ['classes', '-x', 'test'],
            cwd: root,
            message:
              '[Gradle] Downloading dependencies & compiling…\n' +
              '[Gradle] This may take a few minutes on first run.\n',
          },
        ],
      };
    }

    if (action === 'reinstall') {
      return {
        label: 'Gradle · Reinstall Dependencies',
        steps: [
          {
            cmd: gradle,
            args: ['clean', 'classes', '-x', 'test', '--refresh-dependencies'],
            cwd: root,
            message:
              '[Gradle] Cleaning and reinstalling dependencies (--refresh-dependencies)…\n',
          },
        ],
      };
    }

    return {
      label: 'Gradle · Compile',
      steps: [
        {
          cmd: gradle,
          args: ['classes', '-x', 'test'],
          cwd: root,
          message: '[Gradle] Compiling project…\n',
        },
      ],
    };
  }

  private plan(filePath: string, cwd: string, extraArgs: string[]): CommandPlan {
    const abs = path.resolve(filePath);
    const ext = path.extname(abs).toLowerCase();
    const dir = path.dirname(abs);
    const base = path.basename(abs);
    const nameNoExt = path.basename(abs, ext);
    const work = path.resolve(cwd || dir);

    // Spring Boot apps: mvn spring-boot:run / gradle bootRun
    if (isSpringBootRunnablePath(abs)) {
      const project = findJavaProject(abs);
      if (project?.isSpringBoot) {
        return this.planSpringBoot(abs, project, extraArgs);
      }
    }

    if (base === 'pom.xml') {
      const project = findJavaProject(abs);
      const mvn = (project && this.resolveMavenCmd(project)) || this.which(['mvn', 'mvn.cmd'])!;
      const root = project?.root ?? dir;
      return {
        label: 'Maven package',
        steps: [{ cmd: mvn, args: ['package', '-DskipTests'], cwd: root }],
      };
    }

    if (base === 'build.gradle' || base === 'build.gradle.kts') {
      const project = findJavaProject(abs);
      const gradle =
        (project && this.resolveGradleCmd(project)) || this.which(['gradle', 'gradle.bat'])!;
      const root = project?.root ?? dir;
      return {
        label: 'Gradle build',
        steps: [{ cmd: gradle, args: ['build', '-x', 'test'], cwd: root }],
      };
    }

    if (ext === '.java') {
      const javac = this.which(['javac'])!;
      const java = this.which(['java'])!;

      // Packaged classes must be run as FQN (e.g. school.SchoolManagementSystem),
      // with classpath at the package root (out/), not the source folder.
      let packageName = '';
      try {
        packageName = readJavaPackage(fs.readFileSync(abs, 'utf-8'));
      } catch {
        // fall back to default package
      }

      const mainClass = resolveJavaMainClass(nameNoExt, packageName);
      const sourceRoot = resolveJavaSourceRoot(dir, packageName);
      const outDir = path.join(work, 'out');

      let javaSources: string[] = [abs];
      try {
        if (packageName) {
          const found = collectJavaFiles(sourceRoot);
          if (found.length > 0) javaSources = found;
        } else {
          const siblings = fs
            .readdirSync(dir)
            .filter((f) => f.toLowerCase().endsWith('.java'))
            .map((f) => path.join(dir, f));
          if (siblings.length > 0) javaSources = siblings;
        }
      } catch {
        // fall back to single file
      }

      return {
        label: 'Java',
        steps: [
          { cmd: javac, args: ['-d', outDir, ...javaSources], cwd: work },
          { cmd: java, args: ['-cp', outDir, mainClass, ...extraArgs], cwd: work },
        ],
      };
    }

    if (ext === '.py' || ext === '.pyw') {
      const py = this.which(['python', 'python3', 'py'])!;
      const args = process.platform === 'win32' && path.basename(py).toLowerCase() === 'py.exe'
        ? ['-3', abs, ...extraArgs]
        : [abs, ...extraArgs];
      return { label: 'Python', steps: [{ cmd: py, args, cwd: work }] };
    }

    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') {
      const node = this.which(['node'])!;
      return { label: 'Node.js', steps: [{ cmd: node, args: [abs, ...extraArgs], cwd: work }] };
    }

    if (ext === '.ts' || ext === '.tsx') {
      const tsx = this.which(['tsx']);
      if (tsx) {
        return { label: 'tsx', steps: [{ cmd: tsx, args: [abs, ...extraArgs], cwd: work }] };
      }
      const tsNode = this.which(['ts-node']);
      if (tsNode) {
        return { label: 'ts-node', steps: [{ cmd: tsNode, args: [abs, ...extraArgs], cwd: work }] };
      }
      const npx = this.which(['npx'])!;
      return {
        label: 'npx tsx',
        steps: [{ cmd: npx, args: ['--yes', 'tsx', abs, ...extraArgs], cwd: work }],
      };
    }

    if (ext === '.ps1') {
      const ps = this.which(['pwsh', 'powershell'])!;
      return {
        label: 'PowerShell',
        steps: [
          {
            cmd: ps,
            args: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', abs, ...extraArgs],
            cwd: work,
          },
        ],
      };
    }

    if (ext === '.sh' || ext === '.bash') {
      const bash = this.which(['bash', 'sh'])!;
      return { label: 'Shell', steps: [{ cmd: bash, args: [abs, ...extraArgs], cwd: work }] };
    }

    if (ext === '.c') {
      const gcc = this.which(['gcc', 'clang'])!;
      const out = path.join(dir, process.platform === 'win32' ? `${nameNoExt}.exe` : nameNoExt);
      return {
        label: 'C',
        steps: [
          { cmd: gcc, args: [abs, '-o', out], cwd: work },
          { cmd: out, args: extraArgs, cwd: work },
        ],
      };
    }

    if (ext === '.cpp' || ext === '.cc' || ext === '.cxx') {
      const gpp = this.which(['g++', 'clang++'])!;
      const out = path.join(dir, process.platform === 'win32' ? `${nameNoExt}.exe` : nameNoExt);
      return {
        label: 'C++',
        steps: [
          { cmd: gpp, args: [abs, '-o', out], cwd: work },
          { cmd: out, args: extraArgs, cwd: work },
        ],
      };
    }

    if (ext === '.go') {
      const go = this.which(['go'])!;
      return { label: 'Go', steps: [{ cmd: go, args: ['run', abs, ...extraArgs], cwd: work }] };
    }

    if (ext === '.rs') {
      const rustc = this.which(['rustc']);
      if (rustc) {
        const out = path.join(dir, process.platform === 'win32' ? `${nameNoExt}.exe` : nameNoExt);
        return {
          label: 'Rust',
          steps: [
            { cmd: rustc, args: [abs, '-o', out], cwd: work },
            { cmd: out, args: extraArgs, cwd: work },
          ],
        };
      }
      throw new Error('rustc not found');
    }

    if (base === 'package.json') {
      const npm = this.which(['npm'])!;
      return { label: 'npm start', steps: [{ cmd: npm, args: ['start'], cwd: dir }] };
    }

    throw new Error(`No runner for ${ext || base}`);
  }

  /**
   * Stop the running program: kill full process tree (mvn → java) and free
   * any server ports (e.g. 8081) so restart does not hit "port already in use".
   * Also frees ports from the last run even if the parent process already exited.
   */
  stop(runId?: string): RunStopResult {
    const active = this.active;
    if (active && runId && active.id !== runId) {
      return { killed: false, freedPorts: [], message: 'Run id mismatch' };
    }

    const ports = new Set<number>(this.lastKnownPorts);
    if (active) {
      for (const p of active.ports) ports.add(p);
      if (active.projectRoot) this.lastProjectRoot = active.projectRoot;
    }
    if (this.lastProjectRoot) {
      const cfg = readConfiguredServerPort(this.lastProjectRoot);
      if (cfg) ports.add(cfg);
      // Spring Boot defaults when this project looks like one
      try {
        const proj = findJavaProject(this.lastProjectRoot);
        if (proj?.isSpringBoot) {
          ports.add(8080);
          ports.add(8081);
        }
      } catch {
        // ignore
      }
    }
    // If we never tracked a port, still clear common Spring ports so restart works
    if (ports.size === 0) {
      ports.add(8080);
      ports.add(8081);
    }

    let pid: number | undefined;
    if (active) {
      pid = active.proc.pid;
      try {
        active.proc.stdin?.end();
      } catch {
        // ignore
      }
      // 1) Kill entire process tree (cmd → mvnw → maven → spring-boot java)
      if (pid) {
        killProcessTree(pid);
      }
      try {
        active.proc.kill('SIGKILL');
      } catch {
        // ignore
      }
    }

    // 2) Free TCP ports still held by orphaned java processes
    const freed = freePorts([...ports]);
    this.lastKnownPorts.clear();

    const portMsg =
      freed.ports.length > 0
        ? `Freed port(s): ${freed.ports.join(', ')}`
        : `Checked port(s): ${[...ports].slice(0, 6).join(', ')} (already free)`;

    if (active) {
      this.emitOutput({
        runId: active.id,
        stream: 'system',
        data:
          `\n[Stopped] Killed process tree` +
          (pid ? ` (pid ${pid})` : '') +
          `.\n[Stopped] ${portMsg}\n` +
          (freed.ports.length > 0
            ? '[Stopped] You can start the server again without "port already in use".\n'
            : ''),
      });
    }

    this.active = null;
    return {
      killed: Boolean(active) || freed.ports.length > 0,
      freedPorts: freed.ports,
      message: portMsg,
    };
  }

  /**
   * Send user input to the active program's stdin (e.g. menu choices for Java Scanner).
   */
  write(request: RunWriteRequest): void {
    const active = this.active;
    if (!active) {
      throw new Error('No program is running');
    }
    if (request.runId && request.runId !== active.id) {
      throw new Error('Run id mismatch — program already finished or was replaced');
    }
    const stdin = active.proc.stdin;
    if (!stdin || stdin.destroyed || !stdin.writable) {
      throw new Error('Program is not accepting input');
    }
    const data = request.data;
    stdin.write(data, 'utf-8');
    // Echo typed input in the Output panel so the user sees what they sent
    this.emitOutput({
      runId: active.id,
      stream: 'stdin',
      data,
    });
  }

  async start(request: RunProgramRequest): Promise<RunProgramResult> {
    const filePath = path.resolve(request.filePath);
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Stop any previous run and free leftover ports
    const stopResult = this.stop();
    if (stopResult.killed || stopResult.freedPorts.length > 0) {
      // Let Windows release LISTENING sockets before bind
      await new Promise((r) => setTimeout(r, 350));
    }

    const detect = this.detect(filePath);
    if (!detect.available) {
      throw new Error(detect.reason ?? 'Cannot run this file');
    }

    const cwd = request.cwd ? path.resolve(request.cwd) : path.dirname(filePath);
    const plan = this.plan(filePath, cwd, request.args ?? []);
    const runId = randomUUID();
    const startedAt = Date.now();

    // Pre-free configured Spring Boot port so restart always works
    const project = findJavaProject(filePath);
    const prePorts: number[] = [];
    if (project) {
      const cfg = readConfiguredServerPort(project.root);
      if (cfg) prePorts.push(cfg);
      if (project.isSpringBoot) {
        prePorts.push(8080, 8081);
      }
    }
    if (prePorts.length > 0) {
      const freed = freePorts(prePorts);
      if (freed.ports.length > 0) {
        // Will be attached to first system output after runId exists
        this.emitOutput({
          runId,
          stream: 'system',
          data: `[Run] Cleared leftover process(es) on port(s): ${freed.ports.join(', ')}\n`,
        });
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    const commandPreview = plan.steps
      .map((s) => `${s.cmd} ${s.args.map((a) => (a.includes(' ') ? `"${a}"` : a)).join(' ')}`)
      .join(' && ');

    this.emitOutput({
      runId,
      stream: 'system',
      data: `> ${commandPreview}\n`,
    });

    // Do not await process exit — return runId so the UI can send stdin while running
    void this.runSteps(runId, plan.steps, startedAt, project?.root).catch((err) => {
      const message = err instanceof Error ? err.message : String(err);
      this.emitOutput({
        runId,
        stream: 'system',
        data: `Error: ${message}\n`,
      });
      this.emitExit({
        runId,
        code: 1,
        durationMs: Date.now() - startedAt,
      });
      this.active = null;
    });

    return { runId, command: commandPreview, cwd };
  }

  private runSteps(
    runId: string,
    steps: CommandPlan['steps'],
    startedAt: number,
    projectRoot?: string,
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      let index = 0;
      // Ports accumulate across steps for this run id
      const ports = new Set<number>();
      if (projectRoot) {
        const cfg = readConfiguredServerPort(projectRoot);
        if (cfg) ports.add(cfg);
      }

      const trackOutput = (data: string) => {
        for (const p of extractPortsFromOutput(data)) {
          ports.add(p);
          this.lastKnownPorts.add(p);
          if (this.active?.id === runId) this.active.ports.add(p);
        }
      };
      if (projectRoot) this.lastProjectRoot = projectRoot;

      const runNext = () => {
        if (index >= steps.length) {
          this.emitExit({
            runId,
            code: 0,
            durationMs: Date.now() - startedAt,
          });
          this.active = null;
          resolve();
          return;
        }

        const step = steps[index]!;
        index += 1;

        if (step.message) {
          this.emitOutput({
            runId,
            stream: 'system',
            data: step.message,
          });
        }
        this.emitOutput({
          runId,
          stream: 'system',
          data: `$ ${path.basename(step.cmd)} ${step.args.join(' ')}\n`,
        });

        let proc: ChildProcessWithoutNullStreams;
        try {
          proc = this.spawnStep(step.cmd, step.args, step.cwd);
        } catch (err) {
          reject(err);
          return;
        }

        this.active = {
          id: runId,
          proc,
          startedAt,
          ports: new Set(ports),
          projectRoot,
        };

        proc.stdout.on('data', (buf: Buffer) => {
          const data = decodeProcessChunk(buf);
          trackOutput(data);
          this.emitOutput({ runId, stream: 'stdout', data });
        });
        proc.stderr.on('data', (buf: Buffer) => {
          const data = decodeProcessChunk(buf);
          trackOutput(data);
          this.emitOutput({ runId, stream: 'stderr', data });
        });

        proc.on('error', (err) => {
          this.emitOutput({
            runId,
            stream: 'system',
            data: `Error: ${err.message}\n`,
          });
          this.emitExit({
            runId,
            code: 1,
            durationMs: Date.now() - startedAt,
          });
          this.active = null;
          reject(err);
        });

        proc.on('close', (code, signal) => {
          if (code !== 0) {
            const hint = this.failureHint(step, code);
            // Port-in-use: offer clear recovery message
            const portHint =
              hint ||
              (code === 1
                ? '[Hint] If you see "port already in use", press Stop then Run again — the IDE frees 8080/8081 and tracked ports.\n'
                : '');
            this.emitOutput({
              runId,
              stream: 'system',
              data:
                `\nProcess exited with code ${code ?? 'null'}${signal ? ` (signal ${signal})` : ''}\n` +
                (hint ? `${hint}\n` : '') +
                (!hint ? portHint : ''),
            });
            this.emitExit({
              runId,
              code,
              signal,
              durationMs: Date.now() - startedAt,
            });
            this.active = null;
            resolve();
            return;
          }
          // Next step
          runNext();
        });
      };

      runNext();
    });
  }

  /** Friendly recovery tips when Maven/Gradle/Spring Boot fails. */
  private failureHint(step: CommandStep, code: number | null): string {
    const base = path.basename(step.cmd).toLowerCase();
    const joined = step.args.join(' ').toLowerCase();
    if (base.includes('mvn') || joined.includes('spring-boot') || joined.includes('dependency')) {
      return (
        '[Hint] Check that JDK 17+ is installed and JAVA_HOME points to it.\n' +
        '[Hint] If dependencies failed: ensure you have internet access, then press F5 again.\n' +
        '[Hint] You can also open the integrated Terminal and run:  mvnw.cmd spring-boot:run'
      );
    }
    if (base.includes('gradle')) {
      return (
        '[Hint] Check that JDK 17+ is installed.\n' +
        '[Hint] Try:  gradlew.bat bootRun   in the project Terminal.'
      );
    }
    if (code === 1) return '';
    return '';
  }

  /**
   * Spawn a run step.
   * Windows .cmd/.bat wrappers (mvnw.cmd, gradlew.bat) run via cmd.exe using the
   * basename + project cwd so paths with spaces (e.g. "Shoaib Qazi") work.
   * Never use `cmd /s` with a quoted absolute path — it breaks recognition.
   */
  private spawnStep(
    cmd: string,
    args: string[],
    cwd: string,
  ): ChildProcessWithoutNullStreams {
    const env = {
      ...process.env,
      // Color / UTF-8 friendlier Spring Boot + Maven logs in the Output panel
      SPRING_OUTPUT_ANSI_ENABLED: process.env.SPRING_OUTPUT_ANSI_ENABLED ?? 'ALWAYS',
      FORCE_COLOR: process.env.FORCE_COLOR ?? '1',
      TERM: process.env.TERM ?? 'xterm-256color',
      // Prefer UTF-8 so special characters are not dropped on Windows consoles
      JAVA_TOOL_OPTIONS: [process.env.JAVA_TOOL_OPTIONS, '-Dfile.encoding=UTF-8']
        .filter(Boolean)
        .join(' '),
      MAVEN_OPTS: [process.env.MAVEN_OPTS, '-Dfile.encoding=UTF-8'].filter(Boolean).join(' '),
    };

    if (process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd)) {
      const comspec = process.env.ComSpec || 'cmd.exe';
      const absCmd = path.resolve(cmd);
      const wrapperDir = path.dirname(absCmd);
      const wrapperBase = path.basename(absCmd);
      // Prefer project cwd when the wrapper lives there (normal Spring Initializr layout)
      const runCwd =
        path.resolve(cwd) === wrapperDir || fileExists(path.join(cwd, wrapperBase))
          ? path.resolve(cwd)
          : wrapperDir;
      // Basename avoids: '"C:\Users\Name With Spaces\project\mvnw.cmd"' is not recognized
      const exeName = fileExists(path.join(runCwd, wrapperBase)) ? wrapperBase : absCmd;

      const line = [exeName, ...args].map(quoteWinArg).join(' ');
      return spawn(comspec, ['/d', '/c', line], {
        cwd: runCwd,
        env,
        windowsHide: true,
        shell: false,
      });
    }

    // Make Unix mvnw executable if needed (cloned from Windows without +x)
    if (process.platform !== 'win32' && /(^|[/\\])(mvnw|gradlew)$/.test(cmd)) {
      try {
        fs.chmodSync(cmd, 0o755);
      } catch {
        // ignore
      }
    }

    return spawn(cmd, args, {
      cwd,
      env,
      windowsHide: true,
      shell: false,
    });
  }
}
