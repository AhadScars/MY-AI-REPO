export function ScoreRing({
  score,
  size = 148,
  label = "Overall",
}: {
  score: number;
  size?: number;
  label?: string;
}) {
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.max(0, Math.min(100, score)) / 100) * c;
  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E2E8F0" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#2563EB"
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute text-center">
        <div className="font-serif text-4xl text-navy">{score}</div>
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      </div>
    </div>
  );
}

export function RadarChart({
  values,
}: {
  values: Array<{ label: string; value: number }>;
}) {
  const size = 280;
  const cx = size / 2;
  const cy = size / 2;
  const radius = 96;
  const n = values.length || 1;
  const point = (i: number, v: number) => {
    const angle = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    const mag = (Math.max(0, Math.min(100, v)) / 100) * radius;
    return [cx + Math.cos(angle) * mag, cy + Math.sin(angle) * mag] as const;
  };
  const poly = values.map((item, i) => point(i, item.value).join(",")).join(" ");
  const grid = [25, 50, 75, 100];
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" role="img" aria-label="Category score radar">
      {grid.map((g) => (
        <polygon
          key={g}
          fill="none"
          stroke="#E2E8F0"
          points={values.map((_, i) => point(i, g).join(",")).join(" ")}
        />
      ))}
      <polygon points={poly} fill="rgba(37,99,235,0.16)" stroke="#2563EB" strokeWidth="2" />
      {values.map((item, i) => {
        const [x, y] = point(i, 118);
        return (
          <text key={item.label} x={x} y={y} textAnchor="middle" fontSize="10" fill="#475569">
            {item.label}
          </text>
        );
      })}
    </svg>
  );
}

export function LineChart({
  points,
  label,
}: {
  points: number[];
  label: string;
}) {
  const w = 560;
  const h = 220;
  const pad = 28;
  if (!points.length) return null;
  const min = Math.min(40, ...points);
  const max = Math.max(100, ...points);
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, points.length - 1);
  const y = (v: number) => h - pad - ((v - min) / (max - min)) * (h - pad * 2);
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(v)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-auto w-full" role="img" aria-label={label}>
      {[0, 25, 50, 75, 100].map((tick) => {
        const yy = y(tick);
        return (
          <g key={tick}>
            <line x1={pad} x2={w - pad} y1={yy} y2={yy} stroke="#E2E8F0" />
            <text x={8} y={yy + 3} fontSize="10" fill="#94a3b8">
              {tick}
            </text>
          </g>
        );
      })}
      <path d={d} fill="none" stroke="#2563EB" strokeWidth="2.5" />
      {points.map((v, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(v)} r="4" fill="#2563EB" />
          <text x={x(i)} y={h - 8} textAnchor="middle" fontSize="10" fill="#64748b">
            #{i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
