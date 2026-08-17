import { create } from 'zustand';
import { requireApi } from '../services/platform';
import { useWorkspaceStore } from './workspaceStore';
import { useLayoutStore } from './layoutStore';
import { useRunStore } from './runStore';
import type {
  ProjectDepsAction,
  ProjectToolDetectResult,
} from '../../packages/protocol/src/run';

interface MavenState {
  project: ProjectToolDetectResult | null;
  loading: boolean;
  busy: boolean;
  lastAction: ProjectDepsAction | null;
  error: string | null;
  status: string | null;

  refresh: () => Promise<void>;
  installDependencies: () => Promise<void>;
  reinstallDependencies: () => Promise<void>;
  compile: () => Promise<void>;
  openMavenTool: () => void;
}

async function runDepsAction(
  action: ProjectDepsAction,
  set: (partial: Partial<MavenState>) => void,
  get: () => MavenState,
): Promise<void> {
  const root = useWorkspaceStore.getState().rootPath;
  if (!root) {
    set({ error: 'Open a folder that contains pom.xml or build.gradle' });
    return;
  }

  const project = get().project;
  if (project && !project.found) {
    set({ error: project.reason ?? 'No Maven/Gradle project found' });
    return;
  }
  if (project && !project.runnerAvailable) {
    set({ error: project.reason ?? 'Maven/Gradle runner not available' });
    return;
  }

  // Share Output panel with the program runner
  const run = useRunStore.getState();
  run.ensureSubscribed();
  useLayoutStore.getState().setBottomPanelTab('output');
  if (!useLayoutStore.getState().bottomPanelVisible) {
    useLayoutStore.setState({ bottomPanelVisible: true, bottomPanelTab: 'output' });
  }

  set({ busy: true, error: null, lastAction: action, status: null });
  run.clearOutput();
  useRunStore.setState({
    isRunning: true,
    error: null,
    exitCode: null,
    lastFilePath: project?.buildFile ?? root,
  });

  const labels: Record<ProjectDepsAction, string> = {
    install: 'Install Dependencies',
    reinstall: 'Reinstall Dependencies',
    compile: 'Compile',
  };

  run.append('system', `[Maven] ${labels[action]}…\n`);

  try {
    const api = requireApi();
    const result = await api.runProjectDeps({ rootPath: root, action });
    useRunStore.setState({ runId: result.runId, lastCommand: result.command });
    set({ status: `${labels[action]} started — see Output panel` });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    set({ error: message, busy: false });
    useRunStore.setState({ isRunning: false, error: message, runId: null });
    run.append('system', `Error: ${message}\n`);
  }
}

export const useMavenStore = create<MavenState>((set, get) => ({
  project: null,
  loading: false,
  busy: false,
  lastAction: null,
  error: null,
  status: null,

  refresh: async () => {
    const root = useWorkspaceStore.getState().rootPath;
    if (!root) {
      set({
        project: null,
        loading: false,
        error: null,
        status: null,
      });
      return;
    }
    set({ loading: true, error: null });
    try {
      const project = await requireApi().runProjectDetect({ rootPath: root });
      set({ project, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  installDependencies: () => runDepsAction('install', set, get),
  reinstallDependencies: () => runDepsAction('reinstall', set, get),
  compile: () => runDepsAction('compile', set, get),

  openMavenTool: () => {
    useLayoutStore.setState({ sidebarVisible: true, activityView: 'maven' });
    void get().refresh();
  },
}));

// When a run finishes, clear busy and refresh project status
let exitHooked = false;
export function ensureMavenRunExitHook(): void {
  if (exitHooked) return;
  exitHooked = true;
  try {
    requireApi().onRunExit(() => {
      const s = useMavenStore.getState();
      if (s.busy) {
        useMavenStore.setState({
          busy: false,
          status: s.lastAction
            ? `${s.lastAction === 'install' ? 'Install' : s.lastAction === 'reinstall' ? 'Reinstall' : 'Compile'} finished`
            : 'Done',
        });
        void useMavenStore.getState().refresh();
      }
    });
  } catch {
    // browser stub
  }
}
