'use client';
export function PrintButton() {
  return <button type="button" className="ss-print" onClick={() => window.print()}>Descargar PDF ↓</button>;
}
