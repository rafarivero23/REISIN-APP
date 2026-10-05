// Team logos are resized in the browser (max 400px) and stored as a data:
// URL, so they need no file storage. This only accepts small images.
export function cleanLogo(dataUrl: string): string | null {
  const m = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) return null;
  if (m[2].length > 400_000) return null; // ~300 KB
  return dataUrl;
}
