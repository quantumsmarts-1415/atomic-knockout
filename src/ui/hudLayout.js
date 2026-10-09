// Screen-space slots for the battle HUD. Panels stay inside the 1280×720
// frame for a 1v1 and for 3- and 4-player matches. Two players keep the
// original corner placement (centers 240px in from each side).

const EDGE = 20;
const GAP = 12;
const MAX_W = 260;
const PANEL_H = 78;
const TOP_FROM_BOTTOM = 96;

export function hudLayout(count, width = 1280, height = 720) {
  const n = Math.max(1, count | 0);
  let panelW = MAX_W;
  let centers;

  if (n === 1) {
    centers = [width / 2];
  } else if (n === 2) {
    const margin = 240;
    centers = [0, 1].map((i) => margin + (i * (width - margin * 2)) / (n - 1));
  } else {
    const avail = width - EDGE * 2 - GAP * (n - 1);
    panelW = Math.min(MAX_W, Math.max(120, Math.floor(avail / n)));
    const total = n * panelW + GAP * (n - 1);
    if (total > width - 8) panelW = Math.floor((width - 8 - GAP * (n - 1)) / n);
    const first = EDGE + panelW / 2;
    const last = width - EDGE - panelW / 2;
    const step = (last - first) / (n - 1);
    centers = Array.from({ length: n }, (_, i) => first + i * step);
  }

  const top = height - TOP_FROM_BOTTOM;
  return centers.map((x) => ({
    x,
    panelW,
    panelH: PANEL_H,
    top,
    left: x - panelW / 2,
    right: x + panelW / 2,
    bottom: top + PANEL_H,
  }));
}

/** Font size that keeps `label` inside `maxWidth` at roughly this face. */
export function fitLabelSize(label, maxWidth, start = 16, min = 11) {
  const text = String(label ?? '');
  let size = start;
  while (size > min && text.length * size * 0.56 > maxWidth) size -= 1;
  return size;
}
