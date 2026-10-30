// Reisin "R" with a glitch loop: RGB split, sliced jitter and flicker (pure CSS).
// Reisin is the organizing brand; it signs every race page this way.
export function ReisinGlitch({ className = '', label = 'Reisin' }: { className?: string; label?: string }) {
  return (
    <span className={'rg ' + className} role="img" aria-label={label}>
      <i className="rg-base" /><i className="rg-r" aria-hidden /><i className="rg-c" aria-hidden /><i className="rg-s" aria-hidden />
    </span>
  );
}
