/// <reference types="vite/client" />

import type { TerminalIdeApi } from '../packages/protocol/src/api';

declare global {
  interface Window {
    terminalIde?: TerminalIdeApi;
  }

  // Monaco worker environment
  var MonacoEnvironment:
    | {
        getWorker: (workerId: string, label: string) => Worker;
      }
    | undefined;
}

declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

export {};
