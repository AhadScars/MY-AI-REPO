export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#071018" />
      <rect x="0.6" y="0.6" width="62.8" height="62.8" rx="13.4" fill="none" stroke="rgba(20,241,149,0.35)" />
      <path d="M16 46V18h8.4L40 38.4V18H48v28h-8.4L24 27.6V46H16z" fill="#14f195" />
    </svg>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <LogoMark />
      {compact ? null : (
        <span>
          NEXORA
          <span className="faint" style={{ display: 'block', fontSize: 10, letterSpacing: '0.18em', fontWeight: 700 }}>
            SPORTSBOOK
          </span>
        </span>
      )}
    </span>
  );
}
