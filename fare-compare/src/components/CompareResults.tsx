import type { FareOption, Platform, RouteInfo } from '../lib/types';
import { getSurgeLevel, PLATFORM_META } from '../lib/fares';
import { FareCard } from './FareCard';

interface Props {
  options: FareOption[];
  route: RouteInfo;
  city: string;
}

const PLATFORM_ORDER: Platform[] = ['ola', 'uber', 'rapido'];

export function CompareResults({ options, route, city }: Props) {
  const surge = getSurgeLevel();

  // Global cheapest across all apps
  const cheapest = [...options].sort((a, b) => a.minFare - b.minFare)[0];

  // Group by app, each group sorted cheapest → costliest
  const groups = PLATFORM_ORDER.map((platform) => {
    const list = options
      .filter((o) => o.platform === platform)
      .sort((a, b) => a.minFare - b.minFare);
    return {
      platform,
      meta: PLATFORM_META[platform],
      options: list,
      best: list[0] as FareOption | undefined,
    };
  }).filter((g) => g.options.length > 0);

  // Rank apps by their cheapest option
  const appRank = [...groups]
    .sort((a, b) => (a.best?.minFare ?? 0) - (b.best?.minFare ?? 0))
    .map((g) => g.platform);

  return (
    <section className="results">
      <div className="results-summary">
        <div className="summary-stat">
          <span className="stat-label">Distance</span>
          <span className="stat-value">{route.distanceKm.toFixed(1)} km</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">Est. time</span>
          <span className="stat-value">{route.durationMin} min</span>
        </div>
        <div className="summary-stat">
          <span className="stat-label">City</span>
          <span className="stat-value">{city}</span>
        </div>
        <div className={`summary-stat surge-${surge.level}`}>
          <span className="stat-label">Demand</span>
          <span className="stat-value">
            {surge.label}
            {surge.multiplier > 1 && (
              <small> ×{surge.multiplier.toFixed(2)}</small>
            )}
          </span>
        </div>
      </div>

      {cheapest && (
        <div className="winner-banner">
          <div>
            <p className="winner-label">Lowest estimate right now</p>
            <h2>
              <span className={`platform-badge badge-${cheapest.platform}`}>
                {PLATFORM_META[cheapest.platform].name}
              </span>{' '}
              {cheapest.vehicle} — ₹{cheapest.minFare}–{cheapest.maxFare}
            </h2>
          </div>
          <p className="winner-hint">
            Options below are grouped by app. Always confirm the live fare in-app before booking.
          </p>
        </div>
      )}

      <div className="platform-groups">
        {groups.map((group) => {
          const rank = appRank.indexOf(group.platform) + 1;
          const isWinningApp = rank === 1;

          return (
            <section
              key={group.platform}
              className={`platform-group platform-group-${group.platform}${isWinningApp ? ' is-winning-app' : ''}`}
            >
              <header className="platform-group-header">
                <div className="platform-group-title">
                  <span className={`platform-badge badge-${group.platform}`}>
                    {group.meta.name}
                  </span>
                  <div>
                    <h3>{group.meta.name}</h3>
                    <p>{group.meta.tagline}</p>
                  </div>
                </div>
                <div className="platform-group-meta">
                  {isWinningApp ? (
                    <span className="cheapest-tag">Cheapest app</span>
                  ) : (
                    <span className="rank-tag">#{rank} by price</span>
                  )}
                  {group.best && (
                    <span className="platform-from-price">
                      from ₹{group.best.minFare}
                    </span>
                  )}
                </div>
              </header>

              <div className="fare-grid">
                {group.options.map((opt, i) => (
                  <FareCard
                    key={`${opt.platform}-${opt.vehicle}`}
                    option={opt}
                    isCheapest={
                      cheapest?.platform === opt.platform &&
                      cheapest?.vehicle === opt.vehicle
                    }
                    rank={i + 1}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <p className="disclaimer">
        Estimates use typical India rate cards (base + per km + time), city cost index, and
        time-of-day demand. Ola, Uber and Rapido do not publish free public fare APIs — live
        prices, surge, tolls and promos may differ. Use “Open app” to get the exact fare.
      </p>
    </section>
  );
}
