// Desktop shell: start the game server, open a dedicated window (no browser UI).
import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from '../server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Cloud VMs and some Windows boxes blocklist WebGL; keep a software path so
// the window still opens. Real GPUs ignore these and use hardware.
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.commandLine.appendSwitch('use-gl', 'angle');
app.commandLine.appendSwitch('use-angle', 'swiftshader');

let mainWindow = null;
let gameServer = null;

function gameRoot() {
  // Packaged with asar:false → resources/app is the project layout.
  return app.isPackaged ? app.getAppPath() : projectRoot;
}

function iconPath() {
  const root = gameRoot();
  return process.platform === 'win32'
    ? path.join(root, 'build', 'icon.ico')
    : path.join(root, 'build', 'icon.png');
}

async function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 960,
    minHeight: 540,
    title: 'Atomic Knockout',
    backgroundColor: '#07060E',
    autoHideMenuBar: true,
    icon: iconPath(),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
  mainWindow.maximize();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function boot() {
  // Prefer a free port so a leftover npm run dev does not block the desktop app.
  gameServer = await startServer({ root: gameRoot(), port: 0 });
  console.log(`Atomic Knockout desktop → http://127.0.0.1:${gameServer.port}/`);
  console.log(`Phones on the same WiFi: http://${gameServer.lanIp}:${gameServer.port}/controller`);
  await createWindow(gameServer.port);
}

app.whenReady().then(boot).catch((err) => {
  console.error('Failed to start Atomic Knockout:', err);
  app.quit();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('before-quit', () => {
  if (gameServer) {
    gameServer.close().catch(() => {});
    gameServer = null;
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && gameServer) {
    createWindow(gameServer.port);
  }
});
