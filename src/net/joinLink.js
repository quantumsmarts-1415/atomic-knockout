// How a phone reaches this game's controller page.
//
// One server hosts a single shared room: any phone that opens /controller
// joins as the next player. There is no room code. The link shown on the
// host screen and the link encoded in the QR are the same URL.
//
// Phones cannot open localhost / 127.0.0.1, so when the host page itself
// was loaded that way we substitute the LAN address the server advertises
// at /lan-ip. A public or LAN origin (a tunnel hostname, a LAN IP the host
// already used) is already reachable, and the server's LAN IP would be the
// wrong address — keep the page origin in that case.

const LOOPBACK_NAMES = new Set(['localhost', '::1']);

export const CONTROLLER_PATH = '/controller';

export const LOCAL_SERVER_REQUIRED = 'Phone controllers need the local server';

/** True for hosts a phone on the network cannot route to. */
export function isLoopbackHost(hostname) {
  let host = String(hostname ?? '').trim().toLowerCase();
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  if (host.endsWith('.')) host = host.slice(0, -1);
  if (LOOPBACK_NAMES.has(host)) return true;
  return host.startsWith('127.');
}

/**
 * Controller page URL for the host screen.
 * `pageUrl` is the host page's own URL (location.href).
 * `lanIp` / `lanPort` come from the server's /lan-ip advertisement and are
 * used only when `pageUrl` is a loopback origin.
 */
export function buildControllerPageUrl({ pageUrl, lanIp, lanPort, controllerPath = CONTROLLER_PATH } = {}) {
  const url = new URL(pageUrl);
  if (isLoopbackHost(url.hostname) && lanIp && !isLoopbackHost(lanIp)) {
    url.hostname = lanIp;
    if (lanPort != null && `${lanPort}` !== '') url.port = String(lanPort);
  }
  url.pathname = controllerPath.startsWith('/') ? controllerPath : `/${controllerPath}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

/** Sentence shown next to the QR. The URL inside it is the QR payload. */
export function phoneJoinLabel(controllerUrl) {
  return `Phones: open ${controllerUrl} on the same WiFi`;
}

/**
 * `lan` is the parsed /lan-ip JSON, or null when that endpoint isn't there
 * (static hosting, where /ws is missing too). No advertisement means phone
 * controllers cannot connect, so the host must not show a QR.
 */
export function resolveControllerLink({ pageUrl, lan } = {}) {
  if (!lan || typeof lan.ip !== 'string' || lan.ip === '') {
    return { available: false, url: null, label: LOCAL_SERVER_REQUIRED };
  }
  const url = buildControllerPageUrl({ pageUrl, lanIp: lan.ip, lanPort: lan.port });
  return { available: true, url, label: phoneJoinLabel(url) };
}
