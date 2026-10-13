/** Flattens the chart's stacked layer canvases into one JPEG data URL (journal screenshots). */
export function captureChart(): string | null {
  const host = document.querySelector('[data-testid="chart"]');
  const layers = host ? [...host.querySelectorAll('canvas')] : [];
  const first = layers[0];
  if (!first || first.width === 0) return null;
  const out = document.createElement('canvas');
  out.width = first.width;
  out.height = first.height;
  const ctx = out.getContext('2d');
  if (!ctx) return null;
  for (const c of layers) ctx.drawImage(c, 0, 0, out.width, out.height);
  return out.toDataURL('image/jpeg', 0.85);
}
