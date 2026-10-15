// Electron shell: starts the local game server and opens a native window.
// No external browser. Double-click the installed app to play.
import { app, BrowserWindow, shell, Menu, nativeImage } from 'electron';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startGameServer } from '../server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

process.env.ELECTRON_RUN = '1';

// Windows laptops often get a pure-black Phaser canvas when GPU/WebGL fails
// and Chromium refuses the old automatic software fallback. Opt into
// SwiftShader so the desktop app still paints a loading bar / title screen.
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
if (process.env.AK_DISABLE_GPU === '1') {
  app.disableHardwareAcceleration();
}

let mainWindow = null;
let game = null;

function iconPath() {
  const candidates = [
    join(repoRoot, 'branding', 'icon.ico'),
    join(repoRoot, 'branding', 'icon-256.png'),
    join(repoRoot, 'branding', 'icon.png'),
    join(process.resourcesPath || '', 'branding', 'icon.ico'),
  ];
  return candidates.find((p) => p && existsSync(p)) || undefined;
}

function gameRoot() {
  if (process.env.GAME_ROOT && existsSync(process.env.GAME_ROOT)) {
    return process.env.GAME_ROOT;
  }
  // Packaged: electron-builder copies the playable build into resources/game.
  const packaged = join(process.resourcesPath || '', 'game');
  if (app.isPackaged && existsSync(join(packaged, 'index.html'))) {
    return packaged;
  }
  // Dev: prefer game-dist/ (npm run build:game). Never use dist/ — that folder
  // is the Netlify download landing page, not the playable game.
  const gameDist = join(repoRoot, 'game-dist');
  if (existsSync(join(gameDist, 'index.html'))) return gameDist;
  return repoRoot;
}

function createWindow(port) {
  const icon = iconPath();
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    backgroundColor: '#07060E',
    title: 'Atomic Knockout',
    autoHideMenuBar: true,
    icon: icon ? nativeImage.createFromPath(icon) : undefined,
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Sandbox + flaky laptop GPUs was a common black-canvas combo.
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  Menu.setApplicationMenu(null);

  // Surface renderer failures in the main-process log (desktop black-screen debug).
  mainWindow.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    const tag = ['verbose', 'info', 'warning', 'error'][level] || String(level);
    console.log(`[renderer:${tag}] ${message} (${sourceId}:${line})`);
  });
  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[did-fail-load] ${code} ${desc} ${url}`);
  });
  mainWindow.webContents.on('render-process-gone', (_e, details) => {
    console.error('[render-process-gone]', details);
  });

  // Optional: ELECTRON_OPEN_DEVTOOLS=1 for local diagnosis.
  if (process.env.ELECTRON_OPEN_DEVTOOLS === '1') {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
  mainWindow.webContents.on('before-input-event', (_event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      mainWindow.webContents.toggleDevTools();
    }
  });

  mainWindow.loadURL(`http://127.0.0.1:${port}/`);

  // If the renderer never reaches Title, surface something besides a black frame.
  setTimeout(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.executeJavaScript('!!window.__akUiReady', true).then((ready) => {
      if (ready) return;
      return mainWindow.webContents.executeJavaScript(
        `document.querySelector('[data-boot-status]')?.textContent || ''`,
        true,
      ).then((status) => {
        console.error('[boot-watchdog] Title not ready after 45s. Splash:', status);
      });
    }).catch(() => {});
  }, 45000);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function boot() {
  game = await startGameServer({
    root: gameRoot(),
    // Bind loopback only in the desktop app; phones on LAN still work via
    // the printed LAN IP when players opt into phone controllers later.
    host: '127.0.0.1',
    port: 0,
    allowSaveArt: false,
  });
  createWindow(game.port);
}

app.whenReady().then(boot).catch((err) => {
  console.error('Failed to start Atomic Knockout:', err);
  app.quit();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (game) {
    const closing = game.close();
    game = null;
    // Best-effort; Electron is exiting either way.
    closing.catch(() => {});
  }
});

app.on('activate', () => {
  if (mainWindow === null && game) createWindow(game.port);
});
