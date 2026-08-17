import type { FareOption } from '../lib/types';
import { PLATFORM_META } from '../lib/fares';

interface Props {
  option: FareOption;
  isCheapest: boolean;
  rank: number;
}

const CATEGORY_ICON: Record<string, string> = {
  bike: '🏍',
  auto: '🛺',
  mini: '🚗',
  sedan: '🚙',
  suv: '🚐',
  premium: '✨',
};

export function FareCard({ option, isCheapest, rank }: Props) {
  const meta = PLATFORM_META[option.platform];
  const mid = Math.round((option.minFare + option.maxFare) / 2);
  const isBestInApp = rank === 1;

  return (
    <article
      className={`fare-card platform-${option.platform}${isCheapest ? ' is-cheapest' : ''}${isBestInApp && !isCheapest ? ' is-best-in-app' : ''}`}
    >
      <div className="fare-card-top">
        <div className="fare-platform">
          {isCheapest && <span className="cheapest-tag">Best overall</span>}
          {!isCheapest && isBestInApp && (
            <span className="best-in-app-tag">Best in app</span>
          )}
          {!isCheapest && !isBestInApp && (
            <span className="rank-tag">#{rank} in app</span>
          )}
        </div>
        <div className="fare-price">
          <span className="fare-range">
            ₹{option.minFare}
            {option.maxFare !== option.minFare && (
              <span className="fare-to">–{option.maxFare}</span>
            )}
          </span>
          <span className="fare-mid">~₹{mid} est.</span>
        </div>
      </div>

      <div className="fare-vehicle">
        <span className="vehicle-icon" aria-hidden>
          {CATEGORY_ICON[option.category] ?? '🚗'}
        </span>
        <div>
          <h3>{option.vehicle}</h3>
          <p>
            {option.capacity} · ~{option.etaMin} min
          </p>
        </div>
      </div>

      <ul className="fare-features">
        {option.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>

      <a
        className={`book-btn book-${option.platform}`}
        href={option.deepLink}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open {meta.name}
      </a>
    </article>
  );
}
