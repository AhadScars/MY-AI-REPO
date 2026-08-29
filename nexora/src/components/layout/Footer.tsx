import { Link } from 'react-router-dom';
import { Brand } from '../brand/Logo';

export function Footer() {
  return (
    <footer className="footer">
      <div className="container col gap-24">
        <div className="grid-4">
          <div className="col gap-10">
            <Brand />
            <p>Player-vs-player tables in INR. No sports betting. Demo wallet only — no real-money wagering.</p>
            <div className="center gap-8">
              <span className="badge">18+</span>
              <span className="badge">Demo only</span>
              <span className="badge">BeGambleAware</span>
            </div>
          </div>
          <div className="col gap-8">
            <strong style={{ color: 'var(--text)' }}>Company</strong>
            <Link to="/about">About</Link>
            <Link to="/contact">Contact</Link>
            <Link to="/games">Player games</Link>
            <Link to="/help">Help Centre</Link>
            <Link to="/responsible-gambling">Responsible gambling</Link>
          </div>
          <div className="col gap-8">
            <strong style={{ color: 'var(--text)' }}>Legal</strong>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/security">Security</Link>
            <Link to="/licensing">Licensing</Link>
          </div>
          <div className="col gap-8">
            <strong style={{ color: 'var(--text)' }}>Get the app</strong>
            <button type="button" className="btn">
              App Store · coming soon
            </button>
            <button type="button" className="btn">
              Google Play · coming soon
            </button>
            <div className="center gap-12" style={{ marginTop: 8 }}>
              <a href="https://x.com" target="_blank" rel="noreferrer">
                X
              </a>
              <a href="https://instagram.com" target="_blank" rel="noreferrer">
                Instagram
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer">
                YouTube
              </a>
            </div>
          </div>
        </div>
        <p style={{ fontSize: 12 }}>
          Nexora is a product demonstration. It is not licensed by the UKGC, MGA, NJDGE or any other regulator. Do not
          use this site to place real wagers. If gambling is a problem, visit BeGambleAware.org or call 1-800-GAMBLER.
        </p>
      </div>
    </footer>
  );
}
