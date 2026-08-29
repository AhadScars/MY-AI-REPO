import type { Competitor } from '../../types';

export function TeamCrest({
  team,
  size = 36,
}: {
  team?: Competitor;
  size?: number;
}) {
  const bg = team?.color ?? '#1b2736';
  const fg = contrast(bg);
  return (
    <span
      className={`crest ${size > 48 ? 'crest-lg' : ''}`}
      style={{
        width: size,
        height: size,
        background: `linear-gradient(145deg, ${bg}, ${team?.secondary ?? '#111'})`,
        color: fg,
        fontSize: size > 48 ? 18 : 11,
      }}
      aria-hidden="true"
    >
      {team?.abbr ?? '—'}
    </span>
  );
}

function contrast(hex: string) {
  const c = hex.replace('#', '');
  if (c.length < 6) return '#fff';
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const y = (r * 299 + g * 587 + b * 114) / 1000;
  return y > 160 ? '#111' : '#fff';
}
