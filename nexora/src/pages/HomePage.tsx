import { Link } from 'react-router-dom';
import { GamesPage } from './GamesPage';
import { currency } from '../lib/format';
import { pvpRules } from '../data/pvp';

export function HomePage() {
  return (
    <>
      <div className="page" style={{ paddingBottom: 0 }}>
        <div className="wide">
          <section className="hero" style={{ minHeight: 320 }}>
            <img className="cover" src="/images/promo-bg.jpg" alt="" />
            <div className="hero-copy">
              <span className="badge badge-ok">Player vs player · INR</span>
              <h1>Sit down. One winner. Rest get nothing.</h1>
              <p className="muted" style={{ fontSize: 17, maxWidth: 520 }}>
                No sports markets. You play another person. 2-player tables cost {currency(pvpRules.duo.entry)}. 3-player
                tables cost {currency(pvpRules.trio.entry)}.
              </p>
              <div className="flex gap-10 wrap" style={{ marginTop: 22 }}>
                <Link to="/games" className="btn btn-primary btn-lg">
                  Open tables
                </Link>
                <Link to="/register" className="btn btn-lg">
                  Create account
                </Link>
              </div>
            </div>
          </section>
        </div>
      </div>
      <GamesPage />
    </>
  );
}
