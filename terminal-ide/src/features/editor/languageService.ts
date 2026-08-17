/**
 * Language service manager foundation.
 * Monaco ships built-in support for many languages; this module owns the mapping
 * and future LSP process attachments.
 */

export interface LanguageServiceDescriptor {
  id: string;
  monacoLanguage: string;
  displayName: string;
  extensions: string[];
  /** Future: spawn external LSP */
  lspCommand?: string[];
}

export const LANGUAGE_SERVICES: LanguageServiceDescriptor[] = [
  {
    id: 'typescript',
    monacoLanguage: 'typescript',
    displayName: 'TypeScript',
    extensions: ['.ts', '.tsx', '.mts', '.cts'],
  },
  {
    id: 'javascript',
    monacoLanguage: 'javascript',
    displayName: 'JavaScript',
    extensions: ['.js', '.jsx', '.mjs', '.cjs'],
  },
  {
    id: 'python',
    monacoLanguage: 'python',
    displayName: 'Python',
    extensions: ['.py'],
  },
  {
    id: 'json',
    monacoLanguage: 'json',
    displayName: 'JSON',
    extensions: ['.json', '.jsonc'],
  },
  {
    id: 'html',
    monacoLanguage: 'html',
    displayName: 'HTML',
    extensions: ['.html', '.htm'],
  },
  {
    id: 'css',
    monacoLanguage: 'css',
    displayName: 'CSS',
    extensions: ['.css'],
  },
  {
    id: 'markdown',
    monacoLanguage: 'markdown',
    displayName: 'Markdown',
    extensions: ['.md', '.markdown'],
  },
  {
    id: 'rust',
    monacoLanguage: 'rust',
    displayName: 'Rust',
    extensions: ['.rs'],
  },
  {
    id: 'go',
    monacoLanguage: 'go',
    displayName: 'Go',
    extensions: ['.go'],
  },
  {
    id: 'csharp',
    monacoLanguage: 'csharp',
    displayName: 'C#',
    extensions: ['.cs'],
  },
  {
    id: 'java',
    monacoLanguage: 'java',
    displayName: 'Java',
    extensions: ['.java'],
  },
  {
    id: 'cpp',
    monacoLanguage: 'cpp',
    displayName: 'C++',
    extensions: ['.cpp', '.cc', '.cxx', '.hpp'],
  },
  {
    id: 'shell',
    monacoLanguage: 'shell',
    displayName: 'Shell',
    extensions: ['.sh', '.bash', '.zsh'],
  },
  {
    id: 'sql',
    monacoLanguage: 'sql',
    displayName: 'SQL',
    extensions: ['.sql'],
  },
  {
    id: 'yaml',
    monacoLanguage: 'yaml',
    displayName: 'YAML',
    extensions: ['.yaml', '.yml'],
  },
  {
    id: 'php',
    monacoLanguage: 'php',
    displayName: 'PHP',
    extensions: ['.php'],
  },
];

/** Loose typings for Monaco language contributions (API surface varies by version). */
interface MonacoTsApi {
  typescriptDefaults: {
    setDiagnosticsOptions: (opts: Record<string, unknown>) => void;
    setCompilerOptions: (opts: Record<string, unknown>) => void;
  };
  javascriptDefaults: {
    setDiagnosticsOptions: (opts: Record<string, unknown>) => void;
  };
  ScriptTarget: { ES2022: number };
  ModuleResolutionKind: { NodeJs: number };
  ModuleKind: { ESNext: number };
  JsxEmit: { React: number };
}

interface MonacoJsonApi {
  jsonDefaults: {
    setDiagnosticsOptions: (opts: Record<string, unknown>) => void;
  };
}

export class LanguageServiceManager {
  private registered = false;

  /** Configure Monaco built-in language defaults once. */
  configureMonaco(monaco: typeof import('monaco-editor')): void {
    if (this.registered) return;
    this.registered = true;

    try {
      const tsApi = monaco.languages.typescript as unknown as MonacoTsApi;
      if (tsApi?.typescriptDefaults) {
        tsApi.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
        });
        tsApi.typescriptDefaults.setCompilerOptions({
          target: tsApi.ScriptTarget.ES2022,
          allowNonTsExtensions: true,
          moduleResolution: tsApi.ModuleResolutionKind.NodeJs,
          module: tsApi.ModuleKind.ESNext,
          jsx: tsApi.JsxEmit.React,
          allowJs: true,
          esModuleInterop: true,
        });
        tsApi.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: true,
          noSyntaxValidation: false,
        });
      }
    } catch {
      // Language contributions may load asynchronously; safe to skip
    }

    try {
      const jsonApi = monaco.languages.json as unknown as MonacoJsonApi;
      jsonApi?.jsonDefaults?.setDiagnosticsOptions({
        validate: true,
        allowComments: true,
        schemas: [],
        enableSchemaRequest: false,
      });
    } catch {
      // optional
    }
  }

  list(): LanguageServiceDescriptor[] {
    return LANGUAGE_SERVICES;
  }
}

export const languageServiceManager = new LanguageServiceManager();
