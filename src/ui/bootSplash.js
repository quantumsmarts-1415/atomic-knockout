// HTML boot splash helpers. Kept tiny and DOM-only so BootScene can update
// progress even when the Phaser canvas is a black/broken GPU surface.

export function setBootSplashStatus(message, percent = null) {
  if (typeof document === 'undefined') return;
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  const line = splash.querySelector('[data-boot-status]') || splash.querySelector('span');
  if (!line) return;
  let pct = '';
  if (percent != null) {
    const n = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    pct = ` ${n}%`;
  }
  line.textContent = `${message}${pct}`;
}

export function hideBootSplash() {
  if (typeof document === 'undefined') return;
  const splash = document.getElementById('boot-splash');
  if (!splash) return;
  splash.classList.add('is-hidden');
  if (typeof window !== 'undefined') window.__akUiReady = true;
}

export function isElectronShell() {
  if (typeof navigator === 'undefined') return false;
  return /\bElectron\//i.test(navigator.userAgent || '');
}
