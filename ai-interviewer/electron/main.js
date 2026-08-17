/**
 * Lightweight desktop shell for Offline Resume Coach.
 * Starts Next.js locally and opens a Chromium window — no remote content.
 */
const { app, BrowserWindow, shell } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");

const PORT = process.env.PORT || 3000;
const isDev = !app.isPackaged;

let mainWindow = null;
let nextProcess = null;

function waitForServer(url, attempts = 60) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      n += 1;
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => {
        if (n >= attempts) reject(new Error("Local server did not start in time"));
        else setTimeout(tick, 500);
      });
    };
    tick();
  });
}

function startNext() {
  const cwd = path.join(__dirname, "..");
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";
  const args = isDev ? ["run", "dev"] : ["run", "start"];

  nextProcess = spawn(npmCmd, args, {
    cwd,
    env: { ...process.env, PORT: String(PORT), BROWSER: "none" },
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  nextProcess.on("exit", (code) => {
    if (code && code !== 0) {
      console.error("Next.js process exited with code", code);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: "Offline Resume Coach",
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
    show: false,
    backgroundColor: "#070b14",
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1")) {
      return { action: "allow" };
    }
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
}

async function boot() {
  startNext();
  await waitForServer(`http://127.0.0.1:${PORT}`);
  createWindow();
}

app.whenReady().then(() => {
  boot().catch((err) => {
    console.error(err);
    app.quit();
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (nextProcess && !nextProcess.killed) {
    try {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(nextProcess.pid), "/f", "/t"]);
      } else {
        nextProcess.kill("SIGTERM");
      }
    } catch {
      /* ignore */
    }
  }
});
