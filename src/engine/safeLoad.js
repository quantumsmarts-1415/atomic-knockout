// Phaser's loader stops pulling the next batch when a scene update throws,
// and a file with no XHR timeout never fails. Both leave the queue in
// LOADING forever. This drives the queue itself and gives every file a
// deadline, then always resolves.

const LOADER_LOADING = 1;
const FILE_LOADING = 11;
const FILE_PROCESSING = 14;

export const ART_FILE_TIMEOUT_MS = 20000;

const gaveUp = new Set();

export function artGaveUp(key) {
  return gaveUp.has(key);
}

function filesIn(set) {
  if (!set) return [];
  if (typeof set.getArray === 'function') return set.getArray();
  return set.entries || [];
}

function noteSkip(file, skipped, reason) {
  if (!file || file.__akLogged) return;
  file.__akLogged = true;
  file.__akGaveUp = true;
  file.retryAttempts = 0;
  if (file.key) gaveUp.add(file.key);
  skipped.push(file.key);
  const where = file.url || file.src || '';
  console.warn(`[art] ${reason}: ${file.key || '(no key)'} ${where}`.trim());
}

function dropFile(loader, file) {
  if (file.state === FILE_PROCESSING) {
    file.onProcessError?.();
    return;
  }
  const xhr = file.xhrLoader;
  if (xhr) {
    xhr.onload = null;
    xhr.onerror = null;
    xhr.ontimeout = null;
    try { xhr.abort?.(); } catch { /* already closed */ }
  }
  if (loader.inflight?.contains?.(file)) loader.nextFile(file, false);
  else if (loader.list?.contains?.(file)) loader.list.delete(file);
}

/** One watchdog tick. Exported so tests can step it without waiting. */
export function advanceSafeLoad(loader, now, timeoutMs, skipped) {
  if (!loader) return;
  const waiting = [
    ...filesIn(loader.inflight),
    ...filesIn(loader.queue),
  ];
  for (const file of waiting) {
    if (file.state !== FILE_LOADING && file.state !== FILE_PROCESSING) continue;
    if (file.__akSeen == null) file.__akSeen = now;
    if (file.__akGaveUp || now - file.__akSeen < timeoutMs) continue;
    noteSkip(file, skipped, 'timeout');
    dropFile(loader, file);
  }
  const max = loader.maxParallelDownloads || 32;
  if (loader.state === LOADER_LOADING && loader.list?.size > 0 && (loader.inflight?.size || 0) < max) {
    loader.checkLoadQueue?.();
  }
  const idle = (loader.list?.size || 0) === 0
    && (loader.inflight?.size || 0) === 0
    && (loader.queue?.size || 0) === 0;
  if (idle && loader.state === LOADER_LOADING) loader.loadComplete?.();
}

/**
 * Queue files, start the loader, and resolve when the batch finishes.
 * A file that errors or sits past the timeout is logged and skipped.
 * `queue` returns nothing; it should call loader.image / spritesheet.
 */
export function runSafeLoad(scene, queue, { timeoutMs = ART_FILE_TIMEOUT_MS } = {}) {
  const loader = scene?.load;
  if (!loader?.image) return Promise.resolve({ ok: 0, failed: 0, skipped: [] });
  loader.maxRetries = 0;
  if (loader.xhr) loader.xhr.timeout = timeoutMs;
  const before = loader.list?.size || 0;
  queue(loader);
  const added = (loader.list?.size || 0) - before;
  if (added <= 0 && (loader.list?.size || 0) === 0) {
    return Promise.resolve({ ok: 0, failed: 0, skipped: [] });
  }

  return new Promise((resolve) => {
    const skipped = [];
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearInterval(timer);
      loader.off?.('loaderror', onError);
      resolve({
        ok: loader.totalComplete || 0,
        failed: loader.totalFailed || 0,
        skipped,
      });
    };
    const onError = (file) => noteSkip(file, skipped, 'failed');
    loader.on?.('loaderror', onError);
    loader.once?.('complete', finish);

    const timer = setInterval(() => {
      if (scene.sys?.isActive && !scene.sys.isActive()) {
        finish();
        return;
      }
      advanceSafeLoad(loader, performance.now(), timeoutMs, skipped);
      const idle = (loader.list?.size || 0) === 0
        && (loader.inflight?.size || 0) === 0
        && (loader.queue?.size || 0) === 0;
      if (loader.state !== LOADER_LOADING && idle) finish();
    }, 250);

    if (typeof loader.isReady === 'function' && loader.isReady()) loader.start();
    else if (loader.state !== LOADER_LOADING) {
      console.warn(`[art] loader not ready (state ${loader.state})`);
      finish();
    }
  });
}
