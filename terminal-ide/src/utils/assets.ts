/**
 * Asset URLs for packaged Electron (file://) + Vite dev.
 * Always use this instead of absolute paths like "/icon.svg"
 * which break after NSIS install (resolve to C:\icon.svg).
 */
export function assetUrl(fileName: string): string {
  const base = import.meta.env.BASE_URL || './';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${prefix}${fileName.replace(/^\//, '')}`;
}

/** App logo (UI). Prefer PNG for reliable packaged display. */
export const APP_LOGO_PNG = assetUrl('icon.png');
export const APP_LOGO_SVG = assetUrl('icon.svg');
export const APP_LOGO_256 = assetUrl('icon-256.png');
export const APP_FAVICON = assetUrl('favicon.ico');
